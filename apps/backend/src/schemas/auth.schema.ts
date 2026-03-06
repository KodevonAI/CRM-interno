import { z } from 'zod'

export const loginBody = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
})

export type LoginBody = z.infer<typeof loginBody>
