import { google } from 'googleapis'
import { prisma } from '../prisma'

// ─── OAuth2 client ────────────────────────────────────────────

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    `${process.env.FRONTEND_URL?.replace('localhost:3000', 'localhost:3001') ?? 'http://localhost:3001'}/api/auth/gmail/callback`,
  )
}

export function getAuthUrl(): string {
  const oauth2 = getOAuth2Client()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    prompt: 'consent',
  })
}

// Obtiene un cliente autenticado usando el refresh_token guardado en channel_configs
async function getAuthenticatedClient() {
  const config = await prisma.channelConfig.findUnique({
    where: { channel: 'EMAIL' },
  })

  if (!config || !config.active) {
    throw new Error('Gmail no está configurado o no está activo')
  }

  const creds = config.credentials as {
    clientId: string
    clientSecret: string
    refreshToken: string
    email: string
  }

  const oauth2 = new google.auth.OAuth2(creds.clientId, creds.clientSecret)
  oauth2.setCredentials({ refresh_token: creds.refreshToken })
  return { oauth2, email: creds.email }
}

// ─── Leer emails ──────────────────────────────────────────────

export interface GmailMessage {
  id: string
  threadId: string
  from: string
  subject: string
  body: string
  date: Date
}

export async function fetchUnreadEmails(maxResults = 20): Promise<GmailMessage[]> {
  const { oauth2 } = await getAuthenticatedClient()
  const gmail = google.gmail({ version: 'v1', auth: oauth2 })

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread in:inbox',
    maxResults,
  })

  const messages = listRes.data.messages ?? []
  const results: GmailMessage[] = []

  for (const msg of messages) {
    const full = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id!,
      format: 'full',
    })

    const headers = full.data.payload?.headers ?? []
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

    const body = extractBody(full.data.payload)

    results.push({
      id:       msg.id!,
      threadId: full.data.threadId!,
      from:     getHeader('from'),
      subject:  getHeader('subject'),
      body,
      date:     new Date(Number(full.data.internalDate)),
    })
  }

  return results
}

function extractBody(payload: any): string {
  if (!payload) return ''

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8')
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part)
      if (text) return text
    }
  }

  return ''
}

// Marca un email como leído
export async function markAsRead(messageId: string): Promise<void> {
  const { oauth2 } = await getAuthenticatedClient()
  const gmail = google.gmail({ version: 'v1', auth: oauth2 })
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  })
}

// ─── Enviar email ─────────────────────────────────────────────

export async function sendEmail(params: {
  to: string
  subject: string
  body: string
  replyToMessageId?: string
  threadId?: string
}): Promise<string> {
  const { oauth2, email: fromEmail } = await getAuthenticatedClient()
  const gmail = google.gmail({ version: 'v1', auth: oauth2 })

  const headers = [
    `From: ${fromEmail}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    ...(params.replyToMessageId ? [`In-Reply-To: ${params.replyToMessageId}`, `References: ${params.replyToMessageId}`] : []),
  ].join('\r\n')

  const raw = Buffer.from(`${headers}\r\n\r\n${params.body}`)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
      ...(params.threadId ? { threadId: params.threadId } : {}),
    },
  })

  return res.data.id!
}
