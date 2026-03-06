import type { Job } from 'bullmq'
import type { DedupCheckPayload } from '@kodevon/shared'
import { QUEUE_NAMES } from '@kodevon/shared'
import { prisma } from '../lib/prisma'
import { queues } from '../lib/queues'

export async function handleDedupCheck(job: Job<DedupCheckPayload>): Promise<void> {
  const { leadId, email, phone } = job.data

  if (!email && !phone) return

  // Buscar leads con mismo email O teléfono (excluyendo el lead actual y los ya marcados)
  const duplicates = await prisma.lead.findMany({
    where: {
      AND: [
        { id: { not: leadId } },
        { isDuplicate: false },
        {
          OR: [
            ...(email ? [{ email }] : []),
            ...(phone ? [{ phone }] : []),
          ],
        },
      ],
    },
    select: {
      id:            true,
      name:          true,
      email:         true,
      phone:         true,
      sourceChannel: true,
      stage:         true,
      score:         true,
      createdAt:     true,
    },
  })

  if (duplicates.length === 0) return

  console.log(`[dedup] Lead ${leadId} — ${duplicates.length} posible(s) duplicado(s) encontrado(s)`)

  // Notificar a todos los agentes y admins
  await queues.notify.add(QUEUE_NAMES.NOTIFY, {
    type:   'DUPLICATE_DETECTED',
    leadId,
    payload: {
      duplicates: duplicates.map((d) => ({
        id:      d.id,
        name:    d.name,
        email:   d.email,
        phone:   d.phone,
        channel: d.sourceChannel,
        stage:   d.stage,
        score:   d.score,
      })),
      matchField: email ? 'email' : 'phone',
      matchValue: email ?? phone,
    },
  })
}
