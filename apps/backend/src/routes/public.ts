/**
 * API HTTP pública — Fase 9
 *
 * Permite crear leads desde sistemas externos (formularios, integraciones, etc.)
 * autenticando con una API key en formato Bearer.
 *
 * Ejemplo de uso:
 *   curl -X POST https://crm.kodevon.com/api/public/leads \
 *     -H "Authorization: Bearer kv_<96-hex>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"name":"Juan Pérez","email":"juan@empresa.com","phone":"+521234567890","channel":"FORM"}'
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { queues } from '../lib/queues'
import { authenticateApiKey } from '../middleware/authenticate'

// ─── Schema de validación ──────────────────────────────────────

const CHANNEL_VALUES = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'EMAIL', 'FORM', 'API'] as const

const createLeadViaApiSchema = z.object({
  name:    z.string().min(1, 'El nombre es requerido').max(200),
  email:   z.string().email('Email inválido').optional(),
  phone:   z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  channel: z.enum(CHANNEL_VALUES).default('API'),
  notes:   z.string().max(2000).optional(),
  // Mensaje inicial opcional — se crea una conversación y un mensaje INBOUND
  message: z.string().max(5000).optional(),
  // Datos adicionales para pasar al campo metadata del lead
  metadata: z.record(z.unknown()).optional(),
})

// ─── Ruta ─────────────────────────────────────────────────────

const publicRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/public/leads
   * Crea un lead. Si incluye `message`, también crea conversación + mensaje inicial.
   */
  app.post(
    '/leads',
    { preHandler: authenticateApiKey },
    async (request, reply) => {
      const result = createLeadViaApiSchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error:   result.error.issues[0].message,
        })
      }

      const { name, email, phone, company, channel, notes, message, metadata } = result.data

      // Crear lead
      const lead = await prisma.lead.create({
        data: {
          name,
          email,
          phone,
          company,
          sourceChannel: channel,
          notes,
          metadata: metadata ?? undefined,
        },
      })

      // Encolar dedup + espocrm + NEW_LEAD en background
      await Promise.all([
        queues.dedupCheck.add('dedup-check', {
          leadId: lead.id,
          email:  email,
          phone:  phone,
        }),
        queues.espocrmSync.add('espocrm-sync', { leadId: lead.id, action: 'create' }),
        queues.notify.add('notify', {
          type:    'NEW_LEAD',
          leadId:  lead.id,
          payload: { leadName: name, channel, source: 'API' },
        }),
      ])

      // Si viene con mensaje inicial → crear conversación + mensaje INBOUND via worker
      if (message) {
        await queues.inboundMessage.add('inbound-message', {
          channel:    channel as 'API',
          from:       email ?? phone ?? `api-${lead.id}`,
          content:    message,
          externalId: `api-${lead.id}-${Date.now()}`,
          metadata:   { source: 'public-api', leadId: lead.id },
        })
      }

      return reply.status(201).send({
        success: true,
        lead: {
          id:            lead.id,
          name:          lead.name,
          email:         lead.email,
          phone:         lead.phone,
          company:       lead.company,
          sourceChannel: lead.sourceChannel,
          stage:         lead.stage,
          createdAt:     lead.createdAt,
        },
      })
    },
  )

  /**
   * GET /api/public/health
   * Verifica que la API key es válida y el servicio está activo.
   */
  app.get(
    '/health',
    { preHandler: authenticateApiKey },
    async (_request, reply) => {
      return reply.send({ success: true, status: 'ok' })
    },
  )
}

export default publicRoutes
