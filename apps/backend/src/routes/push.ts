import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/authenticate'

const pushRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/push/vapid-public-key
  // Devuelve la clave pública VAPID para que el frontend genere la suscripción
  app.get('/vapid-public-key', async (_req, reply) => {
    return reply.send({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null })
  })

  // POST /api/push/subscribe
  // Guarda o actualiza la suscripción Web Push del usuario autenticado
  app.post('/subscribe', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as { id: string }
    const { endpoint, keys } = request.body as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

    await prisma.pushSubscription.upsert({
      where:  { endpoint },
      create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
    })

    return reply.status(201).send({ success: true })
  })

  // DELETE /api/push/unsubscribe
  // Elimina la suscripción Web Push del usuario
  app.delete('/unsubscribe', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as { id: string }
    const { endpoint } = request.body as { endpoint: string }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: user.id },
    })

    return reply.send({ success: true })
  })
}

export default pushRoutes
