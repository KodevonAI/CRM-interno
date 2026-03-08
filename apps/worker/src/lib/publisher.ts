import IORedis from 'ioredis'

// Conexión dedicada para PUBLISH — separada de la conexión BullMQ
export const publisher = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379')

publisher.on('connect', () => console.log('[publisher] Redis conectado'))
publisher.on('error',   (err) => console.error('[publisher] Redis error:', err.message))
