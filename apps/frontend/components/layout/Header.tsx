'use client'

import { Bell } from 'lucide-react'
import { useNotifications } from '../../lib/hooks'
import { api } from '../../lib/api'
import { mutate } from 'swr'

interface HeaderProps {
  title: string
}

export default function Header({ title }: HeaderProps) {
  const { data } = useNotifications()
  const unread   = data?.notifications.filter((n) => !n.read).length ?? 0

  async function markAll() {
    await api.notifications.markAllRead()
    mutate('notifications')
  }

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-white/5 bg-surface-2 shrink-0">
      <h1 className="text-white font-semibold text-sm">{title}</h1>

      <button
        onClick={markAll}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        title="Notificaciones"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-brand rounded-full" />
        )}
      </button>
    </header>
  )
}
