import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function seed() {
  console.log('[seed] Verificando base de datos...')

  const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })

  if (existingAdmin) {
    console.log('[seed] Ya existe un admin:', existingAdmin.email)
    await prisma.$disconnect()
    return
  }

  const defaultPassword = 'KodevonCRM@2024!'
  const passwordHash = await bcrypt.hash(defaultPassword, 12)

  const admin = await prisma.user.create({
    data: {
      name: 'Admin Kodevon',
      email: 'admin@kodevon.com',
      passwordHash,
      role: 'ADMIN',
    },
    select: { id: true, name: true, email: true, role: true },
  })

  console.log('[seed] ─────────────────────────────────────')
  console.log('[seed] Admin creado exitosamente:')
  console.log('[seed]   Email:    ', admin.email)
  console.log('[seed]   Password: ', defaultPassword)
  console.log('[seed] IMPORTANTE: Cambia la contraseña en tu primer login.')
  console.log('[seed] ─────────────────────────────────────')

  await prisma.$disconnect()
}

seed().catch((e) => {
  console.error('[seed] Error:', e)
  process.exit(1)
})
