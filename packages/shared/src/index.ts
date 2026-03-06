// ─── Enums (mirror del schema Prisma, sin dependencia de @prisma/client) ─────

export type UserRole = 'ADMIN' | 'AGENT' | 'AI_AGENT'

export type LeadStage =
  | 'NUEVO'
  | 'CONTACTADO'
  | 'CALIFICADO'
  | 'PROPUESTA'
  | 'NEGOCIACION'
  | 'CERRADO_GANADO'
  | 'CERRADO_PERDIDO'

export type ScoreLabel = 'COLD' | 'WARM' | 'HOT'

export type Channel =
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'EMAIL'
  | 'FORM'
  | 'API'

export type MessageDirection = 'INBOUND' | 'OUTBOUND'

export type NotificationType =
  | 'NEW_LEAD'
  | 'HOT_LEAD'
  | 'NEW_MESSAGE'
  | 'DUPLICATE_DETECTED'
  | 'MERGE_SUGGESTION'

// ─── Constants ────────────────────────────────────────────────

export const LEAD_STAGES: LeadStage[] = [
  'NUEVO',
  'CONTACTADO',
  'CALIFICADO',
  'PROPUESTA',
  'NEGOCIACION',
  'CERRADO_GANADO',
  'CERRADO_PERDIDO',
]

export const STAGE_LABELS: Record<LeadStage, string> = {
  NUEVO: 'Nuevo',
  CONTACTADO: 'Contactado',
  CALIFICADO: 'Calificado',
  PROPUESTA: 'Propuesta',
  NEGOCIACION: 'Negociación',
  CERRADO_GANADO: 'Cerrado Ganado',
  CERRADO_PERDIDO: 'Cerrado Perdido',
}

export const CHANNEL_LABELS: Record<Channel, string> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  EMAIL: 'Email',
  FORM: 'Formulario',
  API: 'API',
}

export const CHANNEL_COLORS: Record<Channel, string> = {
  WHATSAPP: '#25D366',
  INSTAGRAM: '#E1306C',
  FACEBOOK: '#1877F2',
  EMAIL: '#6366F1',
  FORM: '#F59E0B',
  API: '#64748B',
}

export const SCORE_THRESHOLDS = {
  COLD: { min: 1, max: 3 },
  WARM: { min: 4, max: 7 },
  HOT: { min: 8, max: 10 },
} as const

export const HOT_LEAD_THRESHOLD = 8

// Palabras clave de alta intención para Kodevon (software dev, AI, automatizaciones)
export const HIGH_INTENT_KEYWORDS = [
  'empecemos',
  'quiero empezar',
  'cuánto cuesta',
  'cuanto cuesta',
  'quiero contratar',
  'presupuesto',
  'cotización',
  'cotizacion',
  'cuándo pueden empezar',
  'cuando pueden empezar',
  'lo necesito para',
  'tenemos urgencia',
  'firma',
  'contrato',
  'necesito una propuesta',
  'cuál es el precio',
  'cual es el precio',
  'disponibilidad',
  'cuando empezamos',
  'quiero el servicio',
  'me interesa contratar',
  'qué necesitan de mi parte',
  'que necesitan de mi parte',
]

export const QUEUE_NAMES = {
  INBOUND_MESSAGE: 'inbound-message',
  AI_SCORE: 'ai-score',
  AI_SUMMARY: 'ai-summary',
  DEDUP_CHECK: 'dedup-check',
  NOTIFY: 'notify',
  ESPOCRM_SYNC: 'espocrm-sync',
  GMAIL_POLL: 'gmail-poll',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

// ─── API Types ────────────────────────────────────────────────

export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export type PaginationQuery = {
  page?: number
  limit?: number
  search?: string
}

export type PaginatedResponse<T> = {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── Auth ─────────────────────────────────────────────────────

export type JwtPayload = {
  sub: string   // user id
  email: string
  role: UserRole
  iat: number
  exp: number
}

// ─── Job payloads ─────────────────────────────────────────────

export type InboundMessagePayload = {
  channel: Channel
  externalId: string        // ID del mensaje en el canal externo
  from: string              // teléfono, email, o ID de usuario
  content: string
  contentType?: string
  metadata?: Record<string, unknown>
}

export type AiScorePayload = {
  leadId: string
  triggerMessage?: string
}

export type AiSummaryPayload = {
  leadId: string
}

export type DedupCheckPayload = {
  leadId: string
  email?: string
  phone?: string
}

export type NotifyPayload = {
  type: NotificationType
  leadId?: string
  targetUserIds?: string[]  // vacío = notificar a todos los agentes activos
  payload: Record<string, unknown>
}

export type EspocrmSyncPayload = {
  leadId: string
  action: 'create' | 'update'
}
