// Envío de mensajes para Instagram DMs y Facebook Messenger
// Ambos usan la misma API de Meta con el Page Access Token

const GRAPH_API = 'https://graph.facebook.com/v19.0'

async function sendMetaMessage(
  recipientId: string,
  text: string,
  endpoint: string,
): Promise<string> {
  const token = process.env.META_PAGE_ACCESS_TOKEN

  if (!token) {
    throw new Error('Meta no configurado: falta META_PAGE_ACCESS_TOKEN')
  }

  const res = await fetch(`${GRAPH_API}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message:   { text },
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Meta send error ${res.status}: ${err}`)
  }

  const data = await res.json() as { message_id?: string; mid?: string }
  return data.message_id ?? data.mid ?? 'unknown'
}

export async function sendInstagramMessage(recipientId: string, text: string): Promise<string> {
  const igAccountId = process.env.META_IG_ACCOUNT_ID
  if (!igAccountId) throw new Error('Meta no configurado: falta META_IG_ACCOUNT_ID')
  return sendMetaMessage(recipientId, text, `${igAccountId}/messages`)
}

export async function sendFacebookMessage(recipientId: string, text: string): Promise<string> {
  return sendMetaMessage(recipientId, text, 'me/messages')
}
