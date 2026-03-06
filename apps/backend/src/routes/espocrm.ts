import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma'
import { queues } from '../lib/queues'
import { espocrm } from '../lib/espocrm'
import { authorize } from '../middleware/authenticate'

const espocrmRoutes: FastifyPluginAsync = async (app) => {
  // ─── GET /api/espocrm/status ─────────────────────────────────
  // Verifica la conexión con EspoCRM
  app.get('/status', { preHandler: [authorize('ADMIN')] }, async (_req, reply) => {
    if (!espocrm.isConfigured()) {
      return reply.send({
        success: true,
        data: {
          connected: false,
          reason: 'ESPOCRM_API_KEY no está configurada en las variables de entorno',
        },
      })
    }

    const connected = await espocrm.ping()
    return reply.send({
      success: true,
      data: {
        connected,
        url: process.env.ESPOCRM_URL,
        ...(connected ? {} : { reason: 'No se pudo conectar con EspoCRM' }),
      },
    })
  })

  // ─── POST /api/espocrm/sync-all ──────────────────────────────
  // Re-encola todos los leads sin espocrm_id para sincronización
  app.post('/sync-all', { preHandler: [authorize('ADMIN')] }, async (_req, reply) => {
    if (!espocrm.isConfigured()) {
      return reply.status(400).send({
        success: false,
        error: 'EspoCRM no está configurado. Agrega ESPOCRM_API_KEY al .env',
      })
    }

    const leads = await prisma.lead.findMany({
      where: { espocrmId: null, isDuplicate: false },
      select: { id: true },
    })

    for (const lead of leads) {
      await queues.espocrmSync.add('espocrm-sync', {
        leadId: lead.id,
        action: 'create',
      })
    }

    return reply.send({
      success: true,
      data: {
        queued: leads.length,
        message: `${leads.length} leads encolados para sincronización con EspoCRM`,
      },
    })
  })

  // ─── POST /api/espocrm/sync/:id ──────────────────────────────
  // Fuerza la sincronización de un lead específico
  app.post('/sync/:id', { preHandler: [authorize('ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, espocrmId: true },
    })

    if (!lead) {
      return reply.status(404).send({ success: false, error: 'Lead no encontrado' })
    }

    await queues.espocrmSync.add('espocrm-sync', {
      leadId: id,
      action: lead.espocrmId ? 'update' : 'create',
    })

    return reply.send({
      success: true,
      data: { message: 'Sincronización encolada' },
    })
  })
}

export default espocrmRoutes
