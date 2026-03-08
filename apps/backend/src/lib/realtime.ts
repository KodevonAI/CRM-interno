import { Server as SocketServer } from 'socket.io'
import type { FastifyInstance } from 'fastify'
import IORedis from 'ioredis'
import webpush from 'web-push'
import { prisma } from './prisma'

let io: SocketServer | null = null

export function initRealtime(app: FastifyInstance): SocketServer {
  // ─── Socket.io ────────────────────────────────────────────────
  io = new SocketServer(app.server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
    path: '/socket.io',
  })

  // ─── VAPID config ─────────────────────────────────────────────
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@kodevon.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    )
    console.log('[realtime] Web Push VAPID configurado')
  }

  // ─── Redis subscriber ─────────────────────────────────────────
  // Conexión separada: subscribe y BullMQ no pueden compartir conexión
  const subscriber = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379')

  subscriber.subscribe('crm:notifications', (err) => {
    if (err) console.error('[realtime] Redis subscribe error:', err)
    else console.log('[realtime] Subscribed to crm:notifications')
  })

  subscriber.on('message', async (_channel, message) => {
    try {
      const { userIds, type, leadId, payload } = JSON.parse(message) as {
        userIds: string[]
        type: string
        leadId: string | null
        payload: Record<string, unknown>
      }

      // 1. Emit via Socket.io a usuarios conectados
      for (const userId of userIds) {
        io!.to(`user:${userId}`).emit('notification', { type, leadId, payload })
      }

      // 2. Web Push a suscripciones registradas
      if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        const pushSubs = await prisma.pushSubscription.findMany({
          where: { userId: { in: userIds } },
        })

        if (pushSubs.length > 0) {
          const pushPayload = JSON.stringify({
            title: getTitle(type),
            body:  getBody(type, payload),
            data:  { type, leadId },
          })

          await Promise.allSettled(
            pushSubs.map((sub) =>
              webpush
                .sendNotification(
                  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                  pushPayload,
                )
                .catch(async (err: { statusCode?: number }) => {
                  // 410 Gone → suscripción expirada, eliminarla
                  if (err.statusCode === 410) {
                    await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
                  }
                }),
            ),
          )
        }
      }
    } catch (e) {
      console.error('[realtime] Failed to process message:', e)
    }
  })

  // ─── Socket auth ──────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId as string | undefined
    if (!userId) {
      socket.disconnect()
      return
    }
    socket.join(`user:${userId}`)
    socket.on('disconnect', () => {
      // no-op — handled by Socket.io internally
    })
  })

  return io
}

export function getIO(): SocketServer | null {
  return io
}

// ─── Helpers ──────────────────────────────────────────────────

function getTitle(type: string): string {
  const map: Record<string, string> = {
    NEW_LEAD:           '🆕 Nuevo lead',
    HOT_LEAD:           '🔥 Lead HOT detectado',
    NEW_MESSAGE:        '💬 Nuevo mensaje',
    DUPLICATE_DETECTED: '⚠️ Duplicado detectado',
    MERGE_SUGGESTION:   '🔀 Sugerencia de fusión',
  }
  return map[type] ?? 'Notificación'
}

function getBody(type: string, payload: Record<string, unknown>): string {
  const name = (payload.leadName as string | undefined) ?? 'Lead'
  if (type === 'NEW_LEAD')           return `${name} se ha registrado como nuevo lead`
  if (type === 'HOT_LEAD')           return `${name} tiene score ${payload.score} — momento de actuar`
  if (type === 'NEW_MESSAGE')        return `Nuevo mensaje de ${name}`
  if (type === 'DUPLICATE_DETECTED') return `${name} parece ser un duplicado`
  return 'Nueva notificación en KodevonCRM'
}
