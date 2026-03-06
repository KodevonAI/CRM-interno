import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { getAuthUrl, getOAuth2Client } from '../lib/channels/gmail'
import { prisma } from '../lib/prisma'
import { authorize } from '../middleware/authenticate'

const gmailAuthRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/auth/gmail — redirige al consent screen de Google (solo admin)
  app.get('/gmail', { preHandler: [authorize('ADMIN')] }, async (_req, reply) => {
    const url = getAuthUrl()
    return reply.redirect(url)
  })

  // GET /api/auth/gmail/callback — Google redirige aquí con el code
  app.get('/gmail/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, error } = request.query as { code?: string; error?: string }

    if (error || !code) {
      return reply.status(400).send({
        success: false,
        error: error ?? 'No se recibió código de autorización',
      })
    }

    const oauth2 = getOAuth2Client()
    const { tokens } = await oauth2.getToken(code)

    if (!tokens.refresh_token) {
      return reply.status(400).send({
        success: false,
        error: 'Google no devolvió refresh_token. Asegúrate de que el OAuth se hizo con prompt=consent.',
      })
    }

    // Guardar credenciales en channel_configs
    await prisma.channelConfig.upsert({
      where: { channel: 'EMAIL' },
      update: {
        credentials: {
          clientId:     process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: tokens.refresh_token,
          email:        process.env.GMAIL_EMAIL ?? '',
        },
        active: true,
      },
      create: {
        channel: 'EMAIL',
        credentials: {
          clientId:     process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: tokens.refresh_token,
          email:        process.env.GMAIL_EMAIL ?? '',
        },
        active: true,
      },
    })

    app.log.info('[gmail] OAuth completado y credenciales guardadas')

    // Redirigir al frontend con mensaje de éxito
    return reply.redirect(
      `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/settings?gmail=connected`,
    )
  })

  // GET /api/auth/gmail/status — estado de la conexión
  app.get('/gmail/status', { preHandler: [authorize('ADMIN')] }, async (_req, reply) => {
    const config = await prisma.channelConfig.findUnique({
      where: { channel: 'EMAIL' },
      select: { active: true, updatedAt: true },
    })

    return reply.send({
      success: true,
      data: {
        connected: config?.active ?? false,
        connectedAt: config?.updatedAt ?? null,
      },
    })
  })

  // DELETE /api/auth/gmail/disconnect — desconectar Gmail
  app.delete('/gmail/disconnect', { preHandler: [authorize('ADMIN')] }, async (_req, reply) => {
    await prisma.channelConfig.updateMany({
      where: { channel: 'EMAIL' },
      data:  { active: false },
    })
    return reply.send({ success: true })
  })
}

export default gmailAuthRoutes
