import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/authenticate'
import type { JwtPayload } from '@kodevon/shared'

const apiKeysRoutes: FastifyPluginAsync = async (app) => {
  // ─── GET /api/api-keys ───────────────────────────────────────
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub } = request.user as JwtPayload

    const keys = await prisma.apiKey.findMany({
      where: { userId: sub },
      select: { id: true, name: true, lastUsed: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ success: true, data: keys })
  })

  // ─── POST /api/api-keys ──────────────────────────────────────
  app.post('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { sub } = request.user as JwtPayload
    const { name } = request.body as { name?: string }

    if (!name?.trim()) {
      return reply.status(400).send({ success: false, error: 'El nombre de la API key es requerido' })
    }

    // Verificar que el usuario no tenga más de 10 keys
    const count = await prisma.apiKey.count({ where: { userId: sub } })
    if (count >= 10) {
      return reply.status(400).send({ success: false, error: 'Límite de 10 API keys por usuario' })
    }

    // Generar key: kv_ + 48 bytes hex = 96 chars + prefijo
    const rawKey = `kv_${crypto.randomBytes(48).toString('hex')}`
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

    const apiKey = await prisma.apiKey.create({
      data: { userId: sub, name: name.trim(), keyHash },
      select: { id: true, name: true, createdAt: true },
    })

    // La rawKey se retorna UNA SOLA VEZ — no se puede recuperar después
    return reply.status(201).send({
      success: true,
      data: {
        ...apiKey,
        key: rawKey, // solo disponible en esta respuesta
        warning: 'Guarda esta clave ahora. No podrás verla de nuevo.',
      },
    })
  })

  // ─── DELETE /api/api-keys/:id ────────────────────────────────
  app.delete('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const { sub } = request.user as JwtPayload

    const key = await prisma.apiKey.findFirst({ where: { id, userId: sub } })
    if (!key) {
      return reply.status(404).send({ success: false, error: 'API key no encontrada' })
    }

    await prisma.apiKey.delete({ where: { id } })
    return reply.send({ success: true })
  })
}

export default apiKeysRoutes
