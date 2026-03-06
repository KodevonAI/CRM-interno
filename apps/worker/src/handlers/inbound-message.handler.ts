import type { Job } from 'bullmq'
import type { InboundMessagePayload, Channel } from '@kodevon/shared'
import { QUEUE_NAMES } from '@kodevon/shared'
import { prisma } from '../lib/prisma'
import { queues } from '../lib/queues'

export async function handleInboundMessage(job: Job<InboundMessagePayload>): Promise<void> {
  const { channel, externalId, from, content, contentType = 'text', metadata } = job.data

  // ─── 1. Evitar mensajes duplicados ────────────────────────────
  const existingMsg = await prisma.message.findFirst({
    where: { externalId, conversation: { channel: channel as any } },
  })
  if (existingMsg) {
    console.log(`[inbound] Mensaje duplicado ignorado: ${externalId}`)
    return
  }

  // ─── 2. Buscar o crear lead ───────────────────────────────────
  const isNewLead = { value: false }
  let lead = await findLeadByChannel(channel as Channel, from)

  if (!lead) {
    isNewLead.value = true
    lead = await prisma.lead.create({
      data: {
        name:          formatName(from, channel as Channel),
        sourceChannel: channel as any,
        stage:         'NUEVO',
        ...(channel === 'EMAIL'     && { email: from }),
        ...(channel === 'WHATSAPP'  && { phone: from }),
        metadata:      { channelUserId: from, ...(metadata ?? {}) },
      },
    })
    console.log(`[inbound] Nuevo lead creado: ${lead.id} (${channel} / ${from})`)
  }

  // ─── 3. Buscar o crear conversación ──────────────────────────
  let conversation = await prisma.conversation.findFirst({
    where: { leadId: lead.id, channel: channel as any, status: 'OPEN' },
  })

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        leadId:     lead.id,
        channel:    channel as any,
        externalId: externalId,
        status:     'OPEN',
      },
    })
  }

  // ─── 4. Guardar mensaje ───────────────────────────────────────
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction:      'INBOUND',
      content,
      contentType,
      externalId,
      metadata:       metadata ?? undefined,
    },
  })

  // ─── 5. Encolar jobs de seguimiento ──────────────────────────
  await Promise.all([
    // Scoring de IA en cada mensaje
    queues.aiScore.add(QUEUE_NAMES.AI_SCORE, {
      leadId:         lead.id,
      triggerMessage: content,
    }),

    // Notificar nuevo mensaje a agentes
    queues.notify.add(QUEUE_NAMES.NOTIFY, {
      type:    'NEW_MESSAGE',
      leadId:  lead.id,
      payload: { channel, from, preview: content.slice(0, 120) },
    }),

    // Jobs solo para leads nuevos
    ...(isNewLead.value ? [
      queues.dedupCheck.add(QUEUE_NAMES.DEDUP_CHECK, {
        leadId: lead.id,
        email:  lead.email  ?? undefined,
        phone:  lead.phone  ?? undefined,
      }),
      queues.espocrmSync.add(QUEUE_NAMES.ESPOCRM_SYNC, {
        leadId: lead.id,
        action: 'create',
      }),
      queues.notify.add(QUEUE_NAMES.NOTIFY, {
        type:    'NEW_LEAD',
        leadId:  lead.id,
        payload: { channel, from, name: lead.name },
      }),
    ] : [
      // Lead existente — sync de actualización
      queues.espocrmSync.add(QUEUE_NAMES.ESPOCRM_SYNC, {
        leadId: lead.id,
        action: 'update',
      }),
    ]),
  ])
}

// ─── Helpers ──────────────────────────────────────────────────

async function findLeadByChannel(channel: Channel, from: string) {
  if (channel === 'EMAIL') {
    return prisma.lead.findFirst({
      where:   { email: from, isDuplicate: false },
      orderBy: { createdAt: 'desc' },
    })
  }

  if (channel === 'WHATSAPP') {
    return prisma.lead.findFirst({
      where:   { phone: from, isDuplicate: false },
      orderBy: { createdAt: 'desc' },
    })
  }

  // Instagram, Facebook — match por channelUserId en metadata
  return prisma.lead.findFirst({
    where: {
      sourceChannel: channel as any,
      isDuplicate:   false,
      metadata:      { path: ['channelUserId'], equals: from },
    },
    orderBy: { createdAt: 'desc' },
  })
}

function formatName(from: string, channel: Channel): string {
  if (channel === 'EMAIL')    return from.split('@')[0]
  if (channel === 'WHATSAPP') return `WA ${from}`
  if (channel === 'INSTAGRAM') return `IG ${from}`
  if (channel === 'FACEBOOK')  return `FB ${from}`
  return from
}
