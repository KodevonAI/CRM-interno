import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'
import { queues } from '../lib/queues'
import { authenticate, authorize } from '../middleware/authenticate'
import { createLeadBody, updateLeadBody, listLeadsQuery } from '../schemas/lead.schema'
import { scoreToLabel, paginate, paginatedResponse } from '../lib/utils'
import { HOT_LEAD_THRESHOLD } from '@kodevon/shared'
import type { JwtPayload } from '@kodevon/shared'

const leadsRoutes: FastifyPluginAsync = async (app) => {
  // ─── GET /api/leads ──────────────────────────────────────────
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = listLeadsQuery.safeParse(request.query)
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, error: parseResult.error.issues[0].message })
    }

    const { page, limit, search, stage, channel, scoreLabel, assignedToId } = parseResult.data
    const caller = request.user as JwtPayload

    const where: Record<string, unknown> = {}

    // Agentes solo ven sus leads asignados
    if (caller.role === 'AGENT') where.assignedToId = caller.sub

    if (stage)        where.stage = stage
    if (channel)      where.sourceChannel = channel
    if (scoreLabel)   where.scoreLabel = scoreLabel
    if (assignedToId) where.assignedToId = assignedToId

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        ...paginate(page, limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, phone: true, company: true,
          sourceChannel: true, stage: true, score: true, scoreLabel: true,
          isDuplicate: true, createdAt: true, updatedAt: true,
          assignedTo: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { conversations: true } },
        },
      }),
      prisma.lead.count({ where }),
    ])

    return reply.send({
      success: true,
      data: paginatedResponse(items, total, page, limit),
    })
  })

  // ─── POST /api/leads ─────────────────────────────────────────
  app.post('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const result = createLeadBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error.issues[0].message })
    }

    const lead = await prisma.lead.create({ data: result.data })

    // Encolar deduplicación y sincronización con EspoCRM en background
    await Promise.all([
      queues.dedupCheck.add('dedup-check', {
        leadId: lead.id,
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
      }),
      queues.espocrmSync.add('espocrm-sync', {
        leadId: lead.id,
        action: 'create',
      }),
    ])

    return reply.status(201).send({ success: true, data: lead })
  })

  // ─── GET /api/leads/:id ──────────────────────────────────────
  app.get('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const caller = request.user as JwtPayload

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
        conversations: {
          orderBy: { createdAt: 'desc' },
          include: {
            messages: {
              orderBy: { sentAt: 'asc' },
              take: 50,
            },
          },
        },
        aiScores: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, score: true, label: true, summary: true, createdAt: true },
        },
      },
    })

    if (!lead) return reply.status(404).send({ success: false, error: 'Lead no encontrado' })

    // Agentes solo pueden ver sus leads asignados
    if (caller.role === 'AGENT' && lead.assignedToId !== caller.sub) {
      return reply.status(403).send({ success: false, error: 'Acceso denegado' })
    }

    return reply.send({ success: true, data: lead })
  })

  // ─── PUT /api/leads/:id ──────────────────────────────────────
  app.put('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const caller = request.user as JwtPayload

    const existing = await prisma.lead.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ success: false, error: 'Lead no encontrado' })

    if (caller.role === 'AGENT' && existing.assignedToId !== caller.sub) {
      return reply.status(403).send({ success: false, error: 'Acceso denegado' })
    }

    const result = updateLeadBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error.issues[0].message })
    }

    const updateData: Record<string, unknown> = { ...result.data }

    // Recalcular label si el score cambió
    if (result.data.score !== undefined) {
      updateData.scoreLabel = scoreToLabel(result.data.score)
    }

    const lead = await prisma.lead.update({ where: { id }, data: updateData })

    // Si el score llegó a HOT, disparar notificación y resumen de IA
    if (
      result.data.score !== undefined &&
      result.data.score >= HOT_LEAD_THRESHOLD &&
      existing.score < HOT_LEAD_THRESHOLD
    ) {
      await Promise.all([
        queues.aiSummary.add('ai-summary', { leadId: id }),
        queues.notify.add('notify', {
          type: 'HOT_LEAD',
          leadId: id,
          payload: { leadName: lead.name, score: lead.score },
        }),
      ])
    }

    await queues.espocrmSync.add('espocrm-sync', { leadId: id, action: 'update' })

    return reply.send({ success: true, data: lead })
  })

  // ─── DELETE /api/leads/:id ───────────────────────────────────
  app.delete('/:id', { preHandler: [authorize('ADMIN')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    await prisma.lead.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // ─── POST /api/leads/:id/assign ──────────────────────────────
  app.post('/:id/assign', { preHandler: [authorize('ADMIN')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const { agentId } = request.body as { agentId: string | null }

    const lead = await prisma.lead.update({
      where: { id },
      data: { assignedToId: agentId },
      select: { id: true, name: true, assignedToId: true },
    })

    return reply.send({ success: true, data: lead })
  })

  // ─── POST /api/leads/:id/merge ───────────────────────────────
  app.post('/:id/merge', { preHandler: [authorize('ADMIN')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const { duplicateId, auto } = request.body as { duplicateId: string; auto?: boolean }

    const [primary, duplicate] = await Promise.all([
      prisma.lead.findUnique({ where: { id } }),
      prisma.lead.findUnique({ where: { id: duplicateId } }),
    ])

    if (!primary || !duplicate) {
      return reply.status(404).send({ success: false, error: 'Lead(s) no encontrado(s)' })
    }

    if (!auto) {
      // Solo notificar — fusión manual pendiente de confirmación
      return reply.send({
        success: true,
        data: { message: 'Fusión manual requerida', primary, duplicate },
      })
    }

    // Fusión automática: mover conversaciones al lead principal, marcar duplicado
    await prisma.$transaction([
      prisma.conversation.updateMany({
        where: { leadId: duplicateId },
        data: { leadId: id },
      }),
      prisma.lead.update({
        where: { id },
        data: {
          score: Math.max(primary.score, duplicate.score),
          scoreLabel: scoreToLabel(Math.max(primary.score, duplicate.score)),
          email: primary.email ?? duplicate.email,
          phone: primary.phone ?? duplicate.phone,
        },
      }),
      prisma.lead.update({
        where: { id: duplicateId },
        data: { isDuplicate: true, mergedIntoId: id },
      }),
    ])

    const merged = await prisma.lead.findUnique({ where: { id } })
    return reply.send({ success: true, data: merged })
  })
}

export default leadsRoutes
