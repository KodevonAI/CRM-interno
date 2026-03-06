import IORedis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

export const redis = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

redis.on('connect', () => console.log('[redis] Connected'))
redis.on('error', (err) => console.error('[redis] Error:', err))

// Conexión separada para BullMQ (requiere maxRetriesPerRequest: null)
export const bullConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})
