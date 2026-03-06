// Lector de Gmail para el worker — usa las credenciales guardadas en DB
import { google } from 'googleapis'
import { prisma } from './prisma'

export interface GmailMessage {
  id: string
  threadId: string
  from: string
  subject: string
  body: string
  date: Date
}

async function getAuth() {
  const config = await prisma.channelConfig.findUnique({
    where: { channel: 'EMAIL' },
  })

  if (!config?.active) throw new Error('Gmail no configurado')

  const creds = config.credentials as {
    clientId: string
    clientSecret: string
    refreshToken: string
  }

  const oauth2 = new google.auth.OAuth2(creds.clientId, creds.clientSecret)
  oauth2.setCredentials({ refresh_token: creds.refreshToken })
  return oauth2
}

export async function fetchUnreadEmails(maxResults = 20): Promise<GmailMessage[]> {
  const auth  = await getAuth()
  const gmail = google.gmail({ version: 'v1', auth })

  const list = await gmail.users.messages.list({
    userId:     'me',
    q:          'is:unread in:inbox',
    maxResults,
  })

  const results: GmailMessage[] = []

  for (const msg of list.data.messages ?? []) {
    const full = await gmail.users.messages.get({
      userId: 'me',
      id:     msg.id!,
      format: 'full',
    })

    const headers   = full.data.payload?.headers ?? []
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

    results.push({
      id:       msg.id!,
      threadId: full.data.threadId!,
      from:     getHeader('from'),
      subject:  getHeader('subject'),
      body:     extractBody(full.data.payload),
      date:     new Date(Number(full.data.internalDate)),
    })
  }

  return results
}

export async function markAsRead(messageId: string): Promise<void> {
  const auth  = await getAuth()
  const gmail = google.gmail({ version: 'v1', auth })
  await gmail.users.messages.modify({
    userId:      'me',
    id:          messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  })
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
