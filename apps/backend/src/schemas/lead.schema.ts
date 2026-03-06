import { z } from 'zod'

const CHANNELS = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'EMAIL', 'FORM', 'API'] as const
const STAGES  = ['NUEVO', 'CONTACTADO', 'CALIFICADO', 'PROPUESTA', 'NEGOCIACION', 'CERRADO_GANADO', 'CERRADO_PERDIDO'] as const
const LABELS  = ['COLD', 'WARM', 'HOT'] as const

export const createLeadBody = z.object({
  name:          z.string().min(1).max(200),
  email:         z.string().email().optional(),
  phone:         z.string().max(30).optional(),
  company:       z.string().max(200).optional(),
  sourceChannel: z.enum(CHANNELS),
  notes:         z.string().optional(),
  metadata:      z.record(z.unknown()).optional(),
})

export const updateLeadBody = z.object({
  name:         z.string().min(1).max(200).optional(),
  email:        z.string().email().optional(),
  phone:        z.string().max(30).optional(),
  company:      z.string().max(200).optional(),
  stage:        z.enum(STAGES).optional(),
  score:        z.number().int().min(0).max(10).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  notes:        z.string().optional(),
})

export const listLeadsQuery = z.object({
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(20),
  search:       z.string().optional(),
  stage:        z.enum(STAGES).optional(),
  channel:      z.enum(CHANNELS).optional(),
  scoreLabel:   z.enum(LABELS).optional(),
  assignedToId: z.string().uuid().optional(),
})

export type CreateLeadBody = z.infer<typeof createLeadBody>
export type UpdateLeadBody = z.infer<typeof updateLeadBody>
export type ListLeadsQuery = z.infer<typeof listLeadsQuery>
