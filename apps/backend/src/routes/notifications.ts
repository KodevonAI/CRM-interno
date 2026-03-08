import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/authenticate'

const notificationsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/notifications
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as { id: string }

    const notifications = await prisma.notification.findMany({
      where:   { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take:    50,
    })

    return reply.send({ notifications })
  })

  // PATCH /api/notifications/:id/read
  app.patch('/:id/read', { preHandler: authenticate }, async (request, reply) => {
    const { id }   = request.params as { id: string }
    const user     = request.user as { id: string }

    await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data:  { read: true },
    })

    return reply.send({ success: true })
  })

  // PATCH /api/notifications/read-all
  app.patch('/read-all', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as { id: string }

    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data:  { read: true },
    })

    return reply.send({ success: true })
  })
}

export default notificationsRoutes
