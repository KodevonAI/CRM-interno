import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/authenticate'

const inboxRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/inbox — conversaciones con último mensaje, paginadas
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { page = 1, limit = 30, status = 'OPEN' } = request.query as {
      page?: number
      limit?: number
      status?: string
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where:   status !== 'ALL' ? { status: status as never } : {},
        orderBy: { updatedAt: 'desc' },
        skip,
        take:    Number(limit),
        include: {
          lead: {
            include: {
              assignedTo: { select: { id: true, name: true, email: true } },
            },
          },
          messages: {
            orderBy: { sentAt: 'desc' },
            take:    1,
          },
        },
      }),
      prisma.conversation.count({
        where: status !== 'ALL' ? { status: status as never } : {},
      }),
    ])

    const data = conversations.map((conv) => ({
      ...conv,
      lastMessage:  conv.messages[0] ?? null,
      unreadCount:  conv.messages.filter((m) => m.direction === 'INBOUND').length,
      messages:     undefined,
    }))

    return reply.send({
      data,
      pagination: {
        page:  Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  })
}

export default inboxRoutes
