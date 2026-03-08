/**
 * Formulario web embebible — Fase 10
 *
 * Endpoint que recibe submissions del widget JS embebible.
 * No requiere autenticación — el widget se valida por origen y rate limit.
 *
 * Cómo embeber en cualquier web:
 *   <script
 *     src="https://crm.kodevon.com/widget.js"
 *     data-crm-form="true"
 *     data-crm-title="¿En qué podemos ayudarte?"
 *     data-crm-theme="dark"
 *   ></script>
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { queues } from '../lib/queues'

// ─── Schema ───────────────────────────────────────────────────

const formSubmitSchema = z.object({
  name:    z.string().min(1, 'El nombre es requerido').max(200),
  email:   z.string().email('Email inválido').optional(),
  phone:   z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  message: z.string().min(1, 'El mensaje es requerido').max(5000),
  // Datos de contexto del widget
  source_url: z.string().url().optional(),
  source_page: z.string().max(500).optional(),
})

// ─── Rutas ────────────────────────────────────────────────────

const formWidgetRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/form/submit
   * Recibe el formulario del widget embebido.
   * Rate limit estricto (20/minuto por IP) heredado del global.
   */
  app.post('/submit', async (request, reply) => {
    // CORS permisivo para que cualquier web externa pueda enviar
    void reply.header('Access-Control-Allow-Origin', '*')

    const result = formSubmitSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error:   result.error.issues[0].message,
      })
    }

    const { name, email, phone, company, message, source_url, source_page } = result.data

    // Crear lead con canal FORM
    const lead = await prisma.lead.create({
      data: {
        name,
        email,
        phone,
        company,
        sourceChannel: 'FORM',
        notes:         message,
        metadata: {
          source_url:  source_url  ?? null,
          source_page: source_page ?? null,
          via:         'web-widget',
        },
      },
    })

    // Encolar jobs en background
    await Promise.all([
      // Mensaje inicial → crea conversación + mensaje INBOUND
      queues.inboundMessage.add('inbound-message', {
        channel:    'FORM',
        from:       email ?? phone ?? `form-${lead.id}`,
        content:    message,
        externalId: `form-${lead.id}-${Date.now()}`,
        metadata:   { source: 'web-widget', leadId: lead.id, source_url, source_page },
      }),
      queues.dedupCheck.add('dedup-check', {
        leadId: lead.id,
        email,
        phone,
      }),
      queues.espocrmSync.add('espocrm-sync', { leadId: lead.id, action: 'create' }),
      queues.notify.add('notify', {
        type:    'NEW_LEAD',
        leadId:  lead.id,
        payload: {
          leadName:  name,
          channel:   'FORM',
          email,
          phone,
          source:    source_url ?? 'widget',
        },
      }),
    ])

    return reply.status(201).send({
      success: true,
      message: 'Gracias por contactarnos. Te responderemos pronto.',
    })
  })

  /**
   * OPTIONS /api/form/submit
   * Preflight CORS para peticiones cross-origin del widget.
   */
  app.options('/submit', async (_request, reply) => {
    return reply
      .header('Access-Control-Allow-Origin', '*')
      .header('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .header('Access-Control-Allow-Headers', 'Content-Type')
      .status(204)
      .send()
  })
}

export default formWidgetRoutes
