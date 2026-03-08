import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwtPlugin from '@fastify/jwt'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import authRoutes from './routes/auth'
import usersRoutes from './routes/users'
import leadsRoutes from './routes/leads'
import apiKeysRoutes from './routes/api-keys'
import espocrmRoutes   from './routes/espocrm'
import metaWebhook    from './routes/webhooks/meta'
import gmailAuthRoutes from './routes/gmail-auth'
import messagesRoutes       from './routes/messages'
import inboxRoutes          from './routes/inbox'
import notificationsRoutes  from './routes/notifications'
import pushRoutes           from './routes/push'
import publicRoutes         from './routes/public'
import { initRealtime }     from './lib/realtime'

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    ...(process.env.NODE_ENV !== 'production' && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      },
    }),
  },
})

const start = async () => {
  // ─── Plugins ──────────────────────────────────────────────────
  await app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })

  await app.register(jwtPlugin, {
    secret: process.env.JWT_SECRET || 'dev-secret-CHANGE-IN-PRODUCTION',
    sign: { expiresIn: '15m' },
  })

  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'dev-cookie-secret-CHANGE-IN-PRODUCTION',
  })

  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    // Login: más restrictivo para prevenir fuerza bruta
    keyGenerator: (req) => {
      const isLogin = req.url?.includes('/auth/login')
      return isLogin ? `login-${req.ip}` : req.ip ?? 'unknown'
    },
  })

  // ─── Health ───────────────────────────────────────────────────
  app.get('/api/health', async () => ({
    status: 'ok',
    version: '0.4.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  }))

  // ─── Routes ───────────────────────────────────────────────────
  await app.register(authRoutes,    { prefix: '/api/auth' })
  await app.register(usersRoutes,   { prefix: '/api/users' })
  await app.register(leadsRoutes,   { prefix: '/api/leads' })
  await app.register(apiKeysRoutes, { prefix: '/api/api-keys' })
  await app.register(espocrmRoutes,   { prefix: '/api/espocrm' })
  await app.register(gmailAuthRoutes, { prefix: '/api/auth' })
  await app.register(messagesRoutes,  { prefix: '/api/messages' })
  await app.register(inboxRoutes,         { prefix: '/api/inbox' })
  await app.register(notificationsRoutes, { prefix: '/api/notifications' })
  await app.register(pushRoutes,          { prefix: '/api/push' })
  await app.register(publicRoutes,        { prefix: '/api/public' })
  await app.register(metaWebhook,         { prefix: '/webhooks' })

  // ─── 404 handler ──────────────────────────────────────────────
  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ success: false, error: 'Ruta no encontrada' })
  })

  // ─── Error handler ────────────────────────────────────────────
  app.setErrorHandler((error, _req, reply) => {
    app.log.error(error)
    const status = error.statusCode ?? 500
    reply.status(status).send({
      success: false,
      error: status >= 500 ? 'Error interno del servidor' : error.message,
    })
  })

  // ─── Start ────────────────────────────────────────────────────
  try {
    const port = Number(process.env.PORT) || 3001
    await app.ready()
    initRealtime(app)
    await app.listen({ port, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
