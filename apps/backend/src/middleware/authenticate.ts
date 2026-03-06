import type { FastifyRequest, FastifyReply } from 'fastify'
import type { UserRole, JwtPayload } from '@kodevon/shared'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ success: false, error: 'No autorizado' })
  }
}

export function authorize(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ success: false, error: 'No autorizado' })
    }
    const { role } = request.user as JwtPayload
    if (!roles.includes(role)) {
      return reply.status(403).send({ success: false, error: 'Acceso denegado' })
    }
  }
}

// Middleware para autenticar tanto JWT como API key (para endpoints públicos)
export async function authenticateApiKey(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)

    // Intentar JWT primero
    try {
      await request.jwtVerify()
      return
    } catch {
      // No es JWT — puede ser API key, continuar
    }

    // Verificar como API key
    const { createHash } = await import('crypto')
    const { prisma } = await import('../lib/prisma')
    const keyHash = createHash('sha256').update(token).digest('hex')

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
    })

    if (!apiKey || !apiKey.user.isActive) {
      return reply.status(401).send({ success: false, error: 'API key inválida' })
    }

    // Actualizar last_used sin bloquear la request
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    }).catch(() => {})

    // Inyectar usuario en request para que los handlers lo usen igual que JWT
    ;(request as any).user = {
      sub: apiKey.user.id,
      email: apiKey.user.email,
      role: apiKey.user.role,
    }
    return
  }

  return reply.status(401).send({ success: false, error: 'No autorizado' })
}
