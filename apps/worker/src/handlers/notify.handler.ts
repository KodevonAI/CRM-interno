import type { Job } from 'bullmq'
import type { NotifyPayload } from '@kodevon/shared'
import { prisma } from '../lib/prisma'

export async function handleNotify(job: Job<NotifyPayload>): Promise<void> {
  const { type, leadId, targetUserIds, payload } = job.data

  // Determinar usuarios destino
  let userIds = targetUserIds ?? []

  if (userIds.length === 0) {
    const users = await prisma.user.findMany({
      where:  { isActive: true, role: { in: ['ADMIN', 'AGENT'] } },
      select: { id: true },
    })
    userIds = users.map((u) => u.id)
  }

  if (userIds.length === 0) return

  // Crear registros de notificación en DB
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      leadId: leadId ?? null,
      type,
      payload,
      read: false,
    })),
    skipDuplicates: true,
  })

  console.log(`[notify] ${type} → ${userIds.length} usuario(s)${leadId ? ` | lead: ${leadId}` : ''}`)

  // TODO Fase 8: enviar Web Push + email + sonido in-app via Socket.io
}
