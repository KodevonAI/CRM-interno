import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/authenticate'
import { loginBody, type LoginBody } from '../schemas/auth.schema'
import type { JwtPayload } from '@kodevon/shared'

const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 días
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60    // 7 días en segundos

function hashToken(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

function getCookieDomain(): string | undefined {
  const frontendUrl = process.env.FRONTEND_URL
  if (!frontendUrl) return undefined
  try {
    const hostname = new URL(frontendUrl).hostname
    // Si es un subdominio (crm.kodevon.com), retorna .kodevon.com para compartir entre subdominios
    const parts = hostname.split('.')
    if (parts.length >= 2) return '.' + parts.slice(-2).join('.')
  } catch {}
  return undefined
}

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    domain: getCookieDomain(),
  })
}

const authRoutes: FastifyPluginAsync = async (app) => {
  // ─── POST /api/auth/login ────────────────────────────────────
  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = loginBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error.issues[0].message })
    }
    const { email, password } = result.data as LoginBody

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) {
      return reply.status(401).send({ success: false, error: 'Credenciales inválidas' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return reply.status(401).send({ success: false, error: 'Credenciales inválidas' })
    }

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
    }

    const accessToken = app.jwt.sign(payload)

    // Crear refresh token
    const rawRefresh = crypto.randomBytes(64).toString('hex')
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefresh),
        expiresAt: new Date(Date.now() + REFRESH_EXPIRY_MS),
      },
    })

    setRefreshCookie(reply, rawRefresh)

    return reply.send({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
        },
      },
    })
  })

  // ─── POST /api/auth/refresh ──────────────────────────────────
  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const rawRefresh = request.cookies.refresh_token
    if (!rawRefresh) {
      return reply.status(401).send({ success: false, error: 'Refresh token ausente' })
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawRefresh) },
      include: {
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
    })

    if (!stored || stored.expiresAt < new Date() || !stored.user.isActive) {
      reply.clearCookie('refresh_token', { path: '/', domain: getCookieDomain() })
      return reply.status(401).send({ success: false, error: 'Refresh token inválido o expirado' })
    }

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: stored.user.id,
      email: stored.user.email,
      role: stored.user.role as JwtPayload['role'],
    }

    const accessToken = app.jwt.sign(payload)

    // Rotar refresh token (invalidar el anterior, emitir uno nuevo)
    const newRaw = crypto.randomBytes(64).toString('hex')
    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { tokenHash: hashToken(rawRefresh) } }),
      prisma.refreshToken.create({
        data: {
          userId: stored.user.id,
          tokenHash: hashToken(newRaw),
          expiresAt: new Date(Date.now() + REFRESH_EXPIRY_MS),
        },
      }),
    ])

    setRefreshCookie(reply, newRaw)

    return reply.send({ success: true, data: { accessToken } })
  })

  // ─── POST /api/auth/logout ───────────────────────────────────
  app.post('/logout', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const rawRefresh = request.cookies.refresh_token
    if (rawRefresh) {
      await prisma.refreshToken.deleteMany({
        where: { tokenHash: hashToken(rawRefresh) },
      })
    }
    reply.clearCookie('refresh_token', { path: '/', domain: getCookieDomain() })
    return reply.send({ success: true })
  })

  // ─── GET /api/auth/me ────────────────────────────────────────
  app.get('/me', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub } = request.user as JwtPayload
    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: {
        id: true, name: true, email: true,
        role: true, avatarUrl: true, createdAt: true,
      },
    })
    if (!user) return reply.status(404).send({ success: false, error: 'Usuario no encontrado' })
    return reply.send({ success: true, data: user })
  })
}

export default authRoutes
