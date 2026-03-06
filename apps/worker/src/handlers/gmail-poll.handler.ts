import type { Job } from 'bullmq'
import { QUEUE_NAMES } from '@kodevon/shared'
import { prisma } from '../lib/prisma'
import { queues } from '../lib/queues'

export async function handleGmailPoll(_job: Job): Promise<void> {
  // Verificar si Gmail está configurado y activo
  const config = await prisma.channelConfig.findUnique({
    where: { channel: 'EMAIL' },
  })

  if (!config?.active) return

  // Import dinámico para evitar errores si googleapis no está disponible
  const { fetchUnreadEmails, markAsRead } = await import('../lib/gmail-reader')

  const emails = await fetchUnreadEmails(20)

  if (emails.length === 0) return

  console.log(`[gmail-poll] ${emails.length} emails sin leer encontrados`)

  for (const email of emails) {
    // Verificar si ya fue procesado (por externalId)
    const exists = await prisma.message.findFirst({
      where: { externalId: email.id },
    })

    if (exists) {
      await markAsRead(email.id)
      continue
    }

    // Extraer email del remitente: "Nombre <email@example.com>" → "email@example.com"
    const fromEmail = email.from.match(/<(.+?)>/)?.[1] ?? email.from.trim()

    await queues.inboundMessage.add(QUEUE_NAMES.INBOUND_MESSAGE, {
      channel:     'EMAIL',
      externalId:  email.id,
      from:        fromEmail,
      content:     `Asunto: ${email.subject}\n\n${email.body}`,
      contentType: 'email',
      metadata: {
        subject:  email.subject,
        threadId: email.threadId,
        from:     email.from,
        date:     email.date.toISOString(),
      },
    })

    await markAsRead(email.id)
    console.log(`[gmail-poll] Email encolado: ${email.id} de ${fromEmail}`)
  }
}
