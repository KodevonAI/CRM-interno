import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middleware/authenticate'
import { createUserBody, updateUserBody } from '../schemas/user.schema'
import type { JwtPayload } from '@kodevon/shared'

const usersRoutes: FastifyPluginAsync = async (app) => {
  // ─── GET /api/users ──────────────────────────────────────────
  // Solo ADMIN puede listar todos los usuarios
  app.get('/', { preHandler: [authorize('ADMIN')] }, async (_request, reply) => {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true,
        role: true, isActive: true, avatarUrl: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ success: true, data: users })
  })

  // ─── POST /api/users ─────────────────────────────────────────
  app.post('/', { preHandler: [authorize('ADMIN')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const result = createUserBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error.issues[0].message })
    }
    const { name, email, password, role } = result.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return reply.status(409).send({ success: false, error: 'El email ya está en uso' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    return reply.status(201).send({ success: true, data: user })
  })

  // ─── GET /api/users/:id ──────────────────────────────────────
  app.get('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const caller = request.user as JwtPayload

    // Agentes solo pueden verse a sí mismos
    if (caller.role === 'AGENT' && caller.sub !== id) {
      return reply.status(403).send({ success: false, error: 'Acceso denegado' })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true,
        role: true, isActive: true, avatarUrl: true, createdAt: true,
      },
    })
    if (!user) return reply.status(404).send({ success: false, error: 'Usuario no encontrado' })

    return reply.send({ success: true, data: user })
  })

  // ─── PUT /api/users/:id ──────────────────────────────────────
  app.put('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const caller = request.user as JwtPayload

    // Agentes solo pueden editarse a sí mismos (y no pueden cambiar role/isActive)
    if (caller.role === 'AGENT' && caller.sub !== id) {
      return reply.status(403).send({ success: false, error: 'Acceso denegado' })
    }

    const result = updateUserBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error.issues[0].message })
    }

    const { password, role, isActive, ...rest } = result.data

    // Solo admin puede cambiar rol o estado
    const updateData: Record<string, unknown> = { ...rest }
    if (caller.role === 'ADMIN') {
      if (role !== undefined) updateData.role = role
      if (isActive !== undefined) updateData.isActive = isActive
    }
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12)
    }
    if (rest.email) {
      const taken = await prisma.user.findFirst({
        where: { email: rest.email, NOT: { id } },
      })
      if (taken) return reply.status(409).send({ success: false, error: 'El email ya está en uso' })
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, isActive: true, updatedAt: true },
    })

    return reply.send({ success: true, data: user })
  })

  // ─── DELETE /api/users/:id ───────────────────────────────────
  app.delete('/:id', { preHandler: [authorize('ADMIN')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const caller = request.user as JwtPayload

    if (caller.sub === id) {
      return reply.status(400).send({ success: false, error: 'No puedes eliminar tu propia cuenta' })
    }

    await prisma.user.delete({ where: { id } })
    return reply.send({ success: true })
  })
}

export default usersRoutes
