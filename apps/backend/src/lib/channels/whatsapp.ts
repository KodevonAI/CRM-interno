const GRAPH_API = 'https://graph.facebook.com/v19.0'

interface WASendResult {
  messages: Array<{ id: string }>
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<string> {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID
  const accessToken   = process.env.WA_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp no configurado: faltan WA_PHONE_NUMBER_ID o WA_ACCESS_TOKEN')
  }

  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`WhatsApp send error ${res.status}: ${err}`)
  }

  const data = await res.json() as WASendResult
  return data.messages[0].id
}

// Descarga el contenido de un media (imagen, audio, etc.) desde WhatsApp
export async function getWhatsAppMediaUrl(mediaId: string): Promise<string> {
  const accessToken = process.env.WA_ACCESS_TOKEN!
  const res = await fetch(`${GRAPH_API}/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`WhatsApp media error ${res.status}`)
  const data = await res.json() as { url: string }
  return data.url
}
