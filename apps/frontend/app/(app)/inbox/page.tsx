'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { clsx } from 'clsx'
import { Search, MessageSquare } from 'lucide-react'
import Header from '../../../components/layout/Header'
import ChatWindow from '../../../components/inbox/ChatWindow'
import Badge from '../../../components/ui/Badge'
import { useInbox } from '../../../lib/hooks'
import type { ConversationWithLead } from '../../../lib/api'

const CHANNEL_ICON: Record<string, string> = {
  WHATSAPP:  '💬',
  INSTAGRAM: '📷',
  FACEBOOK:  '👍',
  EMAIL:     '✉️',
  FORM:      '📋',
  API:       '🔌',
}

export default function InboxPage() {
  const [selected, setSelected]   = useState<ConversationWithLead | null>(null)
  const [search, setSearch]       = useState('')
  const { data, isLoading }       = useInbox()

  const conversations = (data?.data ?? []).filter((c) =>
    c.lead.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex flex-col h-full">
      <Header title="Inbox" />
      <div className="flex flex-1 min-h-0">
        {/* Sidebar list */}
        <div className="flex flex-col w-72 xl:w-80 border-r border-white/5 bg-surface-2 shrink-0">
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                className="input w-full pl-9 py-2 text-sm"
                placeholder="Buscar conversación..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                Cargando...
              </div>
            )}
            {!isLoading && conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 gap-2">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <p className="text-sm">Sin conversaciones</p>
              </div>
            )}
            {conversations.map((conv) => {
              const scoreVariant = (
                conv.lead.scoreLabel?.toLowerCase() as 'cold' | 'warm' | 'hot'
              ) ?? 'default'
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelected(conv)}
                  className={clsx(
                    'w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors',
                    selected?.id === conv.id && 'bg-brand/5 border-l-2 border-l-brand',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-brand/20 flex items-center justify-center text-sm font-bold text-brand">
                        {conv.lead.name[0]?.toUpperCase()}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none">
                        {CHANNEL_ICON[conv.channel] ?? '💬'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-white text-xs font-medium truncate">{conv.lead.name}</p>
                        {conv.lastMessage && (
                          <span className="text-gray-600 text-xs shrink-0">
                            {formatDistanceToNow(new Date(conv.lastMessage.sentAt), { locale: es })}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs truncate mt-0.5">
                        {conv.lastMessage?.content ?? 'Sin mensajes'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Badge label={conv.lead.scoreLabel} variant={scoreVariant} />
                        <span className="text-gray-600 text-xs">{conv.lead.score}/10</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <ChatWindow key={selected.id} conversation={selected} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
              <MessageSquare className="w-12 h-12 opacity-20" />
              <p className="text-sm">Selecciona una conversación</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
