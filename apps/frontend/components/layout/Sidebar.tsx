'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import {
  MessageSquare, Users, Settings, LogOut, Bell, Zap,
} from 'lucide-react'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import { useNotifications } from '../../lib/hooks'

const NAV = [
  { href: '/inbox',    icon: MessageSquare, label: 'Inbox'       },
  { href: '/leads',    icon: Users,         label: 'Leads'       },
  { href: '/settings', icon: Settings,      label: 'Ajustes'     },
]

export default function Sidebar() {
  const pathname    = usePathname()
  const router      = useRouter()
  const { user, logout } = useAuthStore()
  const { data }    = useNotifications()

  const unread = data?.notifications.filter((n) => !n.read).length ?? 0

  async function handleLogout() {
    await api.auth.logout().catch(() => {})
    logout()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col w-16 lg:w-56 bg-surface-2 border-r border-white/5 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
        <div className="w-8 h-8 bg-brand rounded-lg shrink-0 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="hidden lg:block font-semibold text-white text-sm tracking-tight">
          KodevonCRM
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-brand/10 text-brand'
                : 'text-gray-400 hover:text-white hover:bg-white/5',
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="hidden lg:block">{label}</span>
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/5 px-2 py-3 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="hidden lg:block min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.name}</p>
            <p className="text-gray-500 text-xs truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="hidden lg:block">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
