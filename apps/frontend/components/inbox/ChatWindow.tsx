'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { Send, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { clsx } from 'clsx'
import { useMessages } from '../../lib/hooks'
import { api, type ConversationWithLead } from '../../lib/api'
import { mutate } from 'swr'
import Badge from '../ui/Badge'

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP:  'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK:  'Facebook',
  EMAIL:     'Email',
  FORM:      'Formulario',
  API:       'API',
}

interface ChatWindowProps {
  conversation: ConversationWithLead
}

export default function ChatWindow({ conversation }: ChatWindowProps) {
  const { data, isLoading } = useMessages(conversation.id)
  const [text, setText]     = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [data])

  const scoreVariant = (
    conversation.lead.scoreLabel?.toLowerCase() as 'cold' | 'warm' | 'hot'
  ) ?? 'default'

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await api.messages.send({
        conversationId: conversation.id,
        content: text.trim(),
        channel: conversation.channel,
        to:
          conversation.channel === 'EMAIL'
            ? conversation.lead.email ?? ''
            : conversation.lead.phone ?? '',
      })
      setText('')
      mutate(['messages', conversation.id])
      mutate(['inbox', undefined])
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 bg-surface-2 shrink-0">
        <div className="w-9 h-9 rounded-full bg-brand/20 flex items-center justify-center text-sm font-bold text-brand">
          {conversation.lead.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white font-medium text-sm truncate">{conversation.lead.name}</p>
            <Badge
              label={conversation.lead.scoreLabel}
              variant={scoreVariant}
            />
          </div>
          <p className="text-gray-500 text-xs">
            {CHANNEL_LABEL[conversation.channel] ?? conversation.channel}
            {conversation.lead.phone && ` · ${conversation.lead.phone}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-gray-500 text-xs">{conversation.lead.stage}</p>
          <p className="text-brand text-xs font-medium">{conversation.lead.score}/10</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading && (
          <p className="text-center text-gray-500 text-sm py-8">Cargando...</p>
        )}
        {data?.messages.map((msg) => (
          <div
            key={msg.id}
            className={clsx(
              'flex',
              msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start',
            )}
          >
            <div
              className={clsx(
                'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm',
                msg.direction === 'OUTBOUND'
                  ? 'bg-brand text-white rounded-br-sm'
                  : 'bg-surface-2 text-gray-200 rounded-bl-sm',
              )}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              <p
                className={clsx(
                  'text-xs mt-1',
                  msg.direction === 'OUTBOUND' ? 'text-white/60 text-right' : 'text-gray-500',
                )}
              >
                {formatDistanceToNow(new Date(msg.sentAt), { addSuffix: true, locale: es })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={send}
        className="flex items-end gap-2 px-4 py-3 border-t border-white/5 bg-surface-2 shrink-0"
      >
        <textarea
          className="input flex-1 resize-none min-h-[40px] max-h-32 py-2 text-sm"
          placeholder="Escribe un mensaje..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(e as unknown as FormEvent)
            }
          }}
          rows={1}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="btn-primary h-10 px-4 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
