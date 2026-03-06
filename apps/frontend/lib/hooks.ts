import useSWR, { type SWRConfiguration } from 'swr'
import { api, type Lead, type ConversationWithLead, type Notification } from './api'

const swrOpts: SWRConfiguration = { revalidateOnFocus: false }

export function useLeads(params?: Record<string, string | number>) {
  return useSWR(['leads', params], () => api.leads.list(params), swrOpts)
}

export function useLead(id: string | null) {
  return useSWR(id ? ['lead', id] : null, () => api.leads.get(id!), swrOpts)
}

export function useInbox(params?: Record<string, string | number>) {
  return useSWR(['inbox', params], () => api.inbox.list(params), {
    ...swrOpts,
    refreshInterval: 15_000,
  })
}

export function useMessages(conversationId: string | null) {
  return useSWR(
    conversationId ? ['messages', conversationId] : null,
    () => api.messages.list(conversationId!),
    { ...swrOpts, refreshInterval: 5_000 },
  )
}

export function useNotifications() {
  return useSWR('notifications', api.notifications.list, {
    ...swrOpts,
    refreshInterval: 30_000,
  })
}

export function useUsers() {
  return useSWR('users', api.users.list, swrOpts)
}

export function useEspocrmStatus() {
  return useSWR('espocrm-status', api.espocrm.status, { ...swrOpts, refreshInterval: 60_000 })
}

export function useGmailStatus() {
  return useSWR('gmail-status', api.gmail.status, { ...swrOpts, refreshInterval: 60_000 })
}
