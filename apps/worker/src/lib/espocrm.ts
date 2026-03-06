import type { LeadStage, Channel } from '@kodevon/shared'

// Copia del cliente en backend — el worker corre en proceso separado
// y no puede importar desde apps/backend

const STAGE_TO_STATUS: Record<LeadStage, string> = {
  NUEVO:           'New',
  CONTACTADO:      'Assigned',
  CALIFICADO:      'In Process',
  PROPUESTA:       'In Process',
  NEGOCIACION:     'In Process',
  CERRADO_GANADO:  'Converted',
  CERRADO_PERDIDO: 'Recycled',
}

const CHANNEL_TO_SOURCE: Record<Channel, string> = {
  WHATSAPP:  'Web Site',
  INSTAGRAM: 'Web Site',
  FACEBOOK:  'Web Site',
  EMAIL:     'Email',
  FORM:      'Web Site',
  API:       'Other',
}

interface EspoCRMLeadInput {
  firstName: string
  lastName: string
  emailAddress?: string
  phoneNumber?: string
  accountName?: string
  status: string
  source?: string
  description?: string
}

class EspoCRMClient {
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor() {
    this.baseUrl = (process.env.ESPOCRM_URL ?? 'http://espocrm:80').replace(/\/$/, '')
    this.apiKey  = process.env.ESPOCRM_API_KEY ?? ''
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey)
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v1/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.apiKey },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`EspoCRM ${method} ${path} → ${res.status}: ${text}`)
    }

    return res.json() as Promise<T>
  }

  async createLead(data: EspoCRMLeadInput): Promise<{ id: string }> {
    return this.request('POST', 'Lead', data)
  }

  async updateLead(id: string, data: Partial<EspoCRMLeadInput>): Promise<void> {
    await this.request('PUT', `Lead/${id}`, data)
  }
}

export const espocrm = new EspoCRMClient()

export function toEspoCRMLead(lead: {
  name: string
  email?: string | null
  phone?: string | null
  company?: string | null
  sourceChannel: Channel
  stage: LeadStage
  notes?: string | null
}): EspoCRMLeadInput {
  const parts     = lead.name.trim().split(/\s+/)
  const firstName = parts[0]
  const lastName  = parts.length > 1 ? parts.slice(1).join(' ') : '.'

  return {
    firstName,
    lastName,
    ...(lead.email   && { emailAddress: lead.email }),
    ...(lead.phone   && { phoneNumber:  lead.phone }),
    ...(lead.company && { accountName:  lead.company }),
    ...(lead.notes   && { description:  lead.notes }),
    status: STAGE_TO_STATUS[lead.stage],
    source: CHANNEL_TO_SOURCE[lead.sourceChannel],
  }
}
