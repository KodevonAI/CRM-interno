import { z } from 'zod'

export const createUserBody = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role: z.enum(['ADMIN', 'AGENT']).default('AGENT'),
})

export const updateUserBody = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['ADMIN', 'AGENT']).optional(),
  isActive: z.boolean().optional(),
})

export type CreateUserBody = z.infer<typeof createUserBody>
export type UpdateUserBody = z.infer<typeof updateUserBody>
