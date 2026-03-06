import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/authenticate'
import { sendWhatsAppMessage } from '../lib/channels/whatsapp'
import { sendInstagramMessage, sendFacebookMessage } from '../lib/channels/meta-messenger'
import { sendEmail } from '../lib/channels/gmail'

const messagesRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/messages/send — enviar mensaje desde el CRM
  app.post('/send', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { conversationId, content, subject } = request.body as {
      conversationId: string
      content: string
      subject?: string  // solo para email
    }

    if (!conversationId || !content?.trim()) {
      return reply.status(400).send({ success: false, error: 'conversationId y content son requeridos' })
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { lead: true },
    })

    if (!conversation) {
      return reply.status(404).send({ success: false, error: 'Conversación no encontrada' })
    }

    if (conversation.status === 'CLOSED') {
      return reply.status(400).send({ success: false, error: 'La conversación está cerrada' })
    }

    const { lead, channel } = conversation
    let externalMessageId: string

    // ─── Enviar por el canal correspondiente ───────────────────
    switch (channel) {
      case 'WHATSAPP': {
        if (!lead.phone) throw new Error('El lead no tiene número de teléfono')
        externalMessageId = await sendWhatsAppMessage(lead.phone, content)
        break
      }
      case 'INSTAGRAM': {
        const senderId = (lead.metadata as any)?.channelUserId
        if (!senderId) throw new Error('No se encontró el ID de Instagram del lead')
        externalMessageId = await sendInstagramMessage(senderId, content)
        break
      }
      case 'FACEBOOK': {
        const senderId = (lead.metadata as any)?.channelUserId
        if (!senderId) throw new Error('No se encontró el ID de Facebook del lead')
        externalMessageId = await sendFacebookMessage(senderId, content)
        break
      }
      case 'EMAIL': {
        if (!lead.email) throw new Error('El lead no tiene email')
        const lastMsg = await prisma.message.findFirst({
          where: { conversationId, direction: 'INBOUND' },
          orderBy: { sentAt: 'desc' },
          select: { externalId: true, metadata: true },
        })
        externalMessageId = await sendEmail({
          to:                lead.email,
          subject:           subject ?? `Re: mensaje de ${lead.name}`,
          body:              content,
          replyToMessageId:  lastMsg?.externalId ?? undefined,
          threadId:          (lastMsg?.metadata as any)?.threadId ?? undefined,
        })
        break
      }
      default:
        return reply.status(400).send({ success: false, error: `Canal ${channel} no soporta envío de mensajes` })
    }

    // ─── Guardar mensaje outbound en DB ────────────────────────
    const message = await prisma.message.create({
      data: {
        conversationId,
        direction:   'OUTBOUND',
        content,
        contentType: 'text',
        externalId:  externalMessageId,
      },
    })

    // Actualizar stage del lead a CONTACTADO si aún es NUEVO
    if (lead.stage === 'NUEVO') {
      await prisma.lead.update({
        where: { id: lead.id },
        data:  { stage: 'CONTACTADO' },
      })
    }

    return reply.status(201).send({ success: true, data: message })
  })

  // GET /api/messages/:conversationId — historial de una conversación
  app.get('/:conversationId', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { conversationId } = request.params as { conversationId: string }
    const { page = 1, limit = 50 } = request.query as { page?: number; limit?: number }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where:   { conversationId },
        orderBy: { sentAt: 'asc' },
        skip:    (Number(page) - 1) * Number(limit),
        take:    Number(limit),
      }),
      prisma.message.count({ where: { conversationId } }),
    ])

    return reply.send({
      success: true,
      data: { messages, total, page: Number(page), limit: Number(limit) },
    })
  })
}

export default messagesRoutes
