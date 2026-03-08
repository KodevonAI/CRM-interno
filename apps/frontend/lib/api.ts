const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const ACCESS_TOKEN_KEY = 'kodevon-access-token'
let accessToken: string | null = null

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

function getStoredAccessToken() {
  if (accessToken) return accessToken
  if (typeof window === 'undefined') return null
  accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY)
  return accessToken
}

function setStoredAccessToken(token: string | null) {
  accessToken = token
  if (typeof window === 'undefined') return
  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
    return
  }
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
}

function parseApiBody<T>(body: unknown): T {
  if (!body || typeof body !== 'object') return body as T
  if ('success' in body) {
    const response = body as { success: boolean; data?: unknown; error?: string }
    if (!response.success) {
      throw new ApiError(400, response.error ?? 'Request failed')
    }
    return response.data as T
  }
  return body as T
}

function getErrorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== 'object') return fallback
  const errorBody = body as { error?: string; message?: string }
  return errorBody.error ?? errorBody.message ?? fallback
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers ?? {})
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getStoredAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })

  const canRefresh = path !== '/api/auth/login' && path !== '/api/auth/refresh'

  if (res.status === 401 && canRefresh) {
    // Try refresh
    const refreshed = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!refreshed.ok) {
      setStoredAccessToken(null)
      // Redirect to login
      if (typeof window !== 'undefined') window.location.href = '/login'
      throw new ApiError(401, 'Session expired')
    }
    const refreshedBody = await refreshed.json().catch(() => undefined)
    const refreshedData = parseApiBody<{ accessToken: string }>(refreshedBody)
    if (refreshedData?.accessToken) {
      setStoredAccessToken(refreshedData.accessToken)
    }

    const retryHeaders = new Headers(options.headers ?? {})
    if (!retryHeaders.has('Content-Type') && options.body) {
      retryHeaders.set('Content-Type', 'application/json')
    }
    const newToken = getStoredAccessToken()
    if (newToken) retryHeaders.set('Authorization', `Bearer ${newToken}`)

    // Retry original
    const retry = await fetch(`${BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: retryHeaders,
    })
    if (!retry.ok) {
      const body = await retry.json().catch(() => ({}))
      throw new ApiError(retry.status, getErrorMessage(body, retry.statusText))
    }
    if (retry.status === 204) return undefined as T
    const retryBody = await retry.json().catch(() => undefined)
    return parseApiBody<T>(retryBody)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, getErrorMessage(body, res.statusText))
  }

  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => undefined)
  return parseApiBody<T>(body)
}

// ─── Auth ────────────────────────────────────────────────────

export const api = {
  auth: {
    login: async (email: string, password: string) => {
      const session = await request<{ user: User; accessToken: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setStoredAccessToken(session.accessToken)
      return session
    },
    logout: async () => {
      try {
        await request('/api/auth/logout', { method: 'POST' })
      } finally {
        setStoredAccessToken(null)
      }
    },
    me: async () => {
      const user = await request<User>('/api/auth/me')
      return { user }
    },
  },

  leads: {
    list: (params?: Record<string, string | number>) => {
      const q = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
      return request<PaginatedResponse<Lead>>(`/api/leads${q}`)
    },
    get: async (id: string) => {
      const lead = await request<Lead>(`/api/leads/${id}`)
      return { lead }
    },
    create: async (data: Partial<Lead>) => {
      const lead = await request<Lead>('/api/leads', { method: 'POST', body: JSON.stringify(data) })
      return { lead }
    },
    update: async (id: string, data: Partial<Lead>) => {
      const lead = await request<Lead>(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      return { lead }
    },
    delete: (id: string) => request(`/api/leads/${id}`, { method: 'DELETE' }),
    assign: async (id: string, userId: string) => {
      const lead = await request<Lead>(`/api/leads/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ agentId: userId || null }),
      })
      return { lead }
    },
    merge: async (id: string, duplicateId: string) => {
      const lead = await request<Lead>(`/api/leads/${id}/merge`, {
        method: 'POST',
        body: JSON.stringify({ duplicateId }),
      })
      return { lead }
    },
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
    send: async (data: SendMessagePayload) => {
      const message = await request<Message>('/api/messages/send', { method: 'POST', body: JSON.stringify(data) })
      return { message }
    },
  },

  notifications: {
    list: () => request<{ notifications: Notification[] }>('/api/notifications'),
    markRead: (id: string) =>
      request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => request('/api/notifications/read-all', { method: 'PATCH' }),
  },

  users: {
    list: async () => {
      const users = await request<User[]>('/api/users')
      return { users }
    },
    update: async (id: string, data: Partial<User>) => {
      const user = await request<User>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      return { user }
    },
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
