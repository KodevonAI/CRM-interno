const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (res.status === 401) {
    // Try refresh
    const refreshed = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!refreshed.ok) {
      // Redirect to login
      if (typeof window !== 'undefined') window.location.href = '/login'
      throw new ApiError(401, 'Session expired')
    }
    // Retry original
    const retry = await fetch(`${BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    if (!retry.ok) {
      const body = await retry.json().catch(() => ({}))
      throw new ApiError(retry.status, body.message ?? retry.statusText)
    }
    return retry.json()
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.message ?? res.statusText)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// ─── Auth ────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: User; accessToken: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => request('/api/auth/logout', { method: 'POST' }),
    me: () => request<{ user: User }>('/api/auth/me'),
  },

  leads: {
    list: (params?: Record<string, string | number>) => {
      const q = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
      return request<PaginatedResponse<Lead>>(`/api/leads${q}`)
    },
    get: (id: string) => request<{ lead: Lead }>(`/api/leads/${id}`),
    create: (data: Partial<Lead>) =>
      request<{ lead: Lead }>('/api/leads', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Lead>) =>
      request<{ lead: Lead }>(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/api/leads/${id}`, { method: 'DELETE' }),
    assign: (id: string, userId: string) =>
      request<{ lead: Lead }>(`/api/leads/${id}/assign`, { method: 'POST', body: JSON.stringify({ userId }) }),
    merge: (id: string, duplicateId: string) =>
      request<{ lead: Lead }>(`/api/leads/${id}/merge`, { method: 'POST', body: JSON.stringify({ duplicateLeadId: duplicateId }) }),
  },

  inbox: {
    list: (params?: Record<string, string | number>) => {
      const q = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
      return request<PaginatedResponse<ConversationWithLead>>(`/api/inbox${q}`)
    },
  },

  messages: {
    list: (conversationId: string) =>
      request<{ messages: Message[] }>(`/api/messages/${conversationId}`),
    send: (data: SendMessagePayload) =>
      request<{ message: Message }>('/api/messages/send', { method: 'POST', body: JSON.stringify(data) }),
  },

  notifications: {
    list: () => request<{ notifications: Notification[] }>('/api/notifications'),
    markRead: (id: string) =>
      request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => request('/api/notifications/read-all', { method: 'PATCH' }),
  },

  users: {
    list: () => request<{ users: User[] }>('/api/users'),
    update: (id: string, data: Partial<User>) =>
      request<{ user: User }>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  espocrm: {
    status: () => request<{ connected: boolean; version?: string }>('/api/espocrm/status'),
    syncAll: () => request('/api/espocrm/sync-all', { method: 'POST' }),
  },

  gmail: {
    status: () => request<{ connected: boolean; email?: string }>('/api/auth/gmail/status'),
    getAuthUrl: () => request<{ url: string }>('/api/auth/gmail'),
    disconnect: () => request('/api/auth/gmail/disconnect', { method: 'DELETE' }),
  },
}

// ─── Types ────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'AGENT'
  isActive: boolean
  createdAt: string
}

export interface Lead {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  sourceChannel: string
  stage: string
  score: number
  scoreLabel: 'COLD' | 'WARM' | 'HOT'
  isDuplicate: boolean
  assignedTo?: User
  aiScores?: AiScore[]
  conversations?: Conversation[]
  createdAt: string
  updatedAt: string
}

export interface AiScore {
  id: string
  score: number
  label: string
  summary?: string
  factors?: Record<string, unknown>
  createdAt: string
}

export interface Conversation {
  id: string
  leadId: string
  channel: string
  status: string
  messages?: Message[]
  createdAt: string
}

export interface ConversationWithLead extends Conversation {
  lead: Lead
  lastMessage?: Message
  unreadCount?: number
}

export interface Message {
  id: string
  conversationId: string
  direction: 'INBOUND' | 'OUTBOUND'
  content: string
  sentAt: string
}

export interface Notification {
  id: string
  type: string
  read: boolean
  leadId?: string
  payload?: Record<string, unknown>
  createdAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface SendMessagePayload {
  conversationId: string
  content: string
  channel: string
  to: string
}
