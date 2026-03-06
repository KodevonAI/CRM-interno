import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { queues } from '../../lib/queues'

// ─── Tipos del payload de Meta ────────────────────────────────

interface MetaWebhookBody {
  object: 'whatsapp_business_account' | 'instagram' | 'page'
  entry: MetaEntry[]
}

interface MetaEntry {
  id: string
  changes?: WhatsAppChange[]   // WhatsApp
  messaging?: MetaMessaging[]  // Instagram + Facebook
}

interface WhatsAppChange {
  value: {
    messaging_product: string
    messages?: WAMessage[]
    statuses?: unknown[]
  }
  field: string
}

interface WAMessage {
  id: string
  from: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type: string; caption?: string }
  audio?: { id: string }
  document?: { id: string; filename?: string }
}

interface MetaMessaging {
  sender:    { id: string }
  recipient: { id: string }
  timestamp: number
  message?: {
    mid: string
    text?: string
    attachments?: Array<{ type: string; payload: { url?: string } }>
  }
}

// ─── Plugin ───────────────────────────────────────────────────

const metaWebhookRoutes: FastifyPluginAsync = async (app) => {
  // GET /webhooks/meta — verificación del webhook por Meta
  app.get('/meta', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as Record<string, string>

    if (
      q['hub.mode'] === 'subscribe' &&
      q['hub.verify_token'] === process.env.WA_WEBHOOK_VERIFY_TOKEN
    ) {
      return reply.status(200).send(q['hub.challenge'])
    }

    return reply.status(403).send('Verificación fallida')
  })

  // POST /webhooks/meta — mensajes entrantes de WA + IG + FB
  app.post('/meta', async (request: FastifyRequest, reply: FastifyReply) => {
    // Responder 200 inmediatamente — Meta requiere respuesta rápida
    reply.status(200).send('EVENT_RECEIVED')

    const body = request.body as MetaWebhookBody

    try {
      if (body.object === 'whatsapp_business_account') {
        await processWhatsApp(body)
      } else if (body.object === 'instagram') {
        await processInstagram(body)
      } else if (body.object === 'page') {
        await processFacebook(body)
      }
    } catch (err) {
      app.log.error({ err }, '[webhook:meta] Error procesando evento')
    }
  })
}

// ─── Procesadores ─────────────────────────────────────────────

async function processWhatsApp(body: MetaWebhookBody) {
  for (const entry of body.entry) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue

      for (const msg of change.value.messages ?? []) {
        const content = extractWAContent(msg)
        if (!content) continue

        await queues.inboundMessage.add('inbound-message', {
          channel:     'WHATSAPP',
          externalId:  msg.id,
          from:        msg.from,
          content:     content.text,
          contentType: content.type,
          metadata:    { waMessageId: msg.id, timestamp: msg.timestamp },
        })
      }
    }
  }
}

async function processInstagram(body: MetaWebhookBody) {
  for (const entry of body.entry) {
    for (const event of entry.messaging ?? []) {
      if (!event.message?.text) continue

      await queues.inboundMessage.add('inbound-message', {
        channel:     'INSTAGRAM',
        externalId:  event.message.mid,
        from:        event.sender.id,
        content:     event.message.text,
        contentType: 'text',
        metadata:    { igSenderId: event.sender.id, pageId: entry.id },
      })
    }
  }
}

async function processFacebook(body: MetaWebhookBody) {
  for (const entry of body.entry) {
    for (const event of entry.messaging ?? []) {
      if (!event.message?.text) continue

      await queues.inboundMessage.add('inbound-message', {
        channel:     'FACEBOOK',
        externalId:  event.message.mid,
        from:        event.sender.id,
        content:     event.message.text,
        contentType: 'text',
        metadata:    { fbSenderId: event.sender.id, pageId: entry.id },
      })
    }
  }
}

function extractWAContent(msg: WAMessage): { text: string; type: string } | null {
  if (msg.type === 'text' && msg.text?.body) {
    return { text: msg.text.body, type: 'text' }
  }
  if (msg.type === 'image') {
    return { text: `[imagen: ${msg.image?.id}]`, type: 'image' }
  }
  if (msg.type === 'audio') {
    return { text: `[audio: ${msg.audio?.id}]`, type: 'audio' }
  }
  if (msg.type === 'document') {
    return { text: `[documento: ${msg.document?.filename ?? msg.document?.id}]`, type: 'document' }
  }
  return null
}

export default metaWebhookRoutes
