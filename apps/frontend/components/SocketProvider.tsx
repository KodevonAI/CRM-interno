'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useSWRConfig } from 'swr'
import { useAuthStore } from '../store/auth.store'
import { X, Bell, Flame, MessageCircle, Copy, GitMerge } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────

interface NotificationEvent {
  type: string
  leadId: string | null
  payload: Record<string, unknown>
}

interface Toast {
  id: string
  type: string
  title: string
  body: string
  leadId: string | null
}

// ─── Sound ────────────────────────────────────────────────────

function playSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // AudioContext puede fallar en contextos sin interacción previa del usuario
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function getTitle(type: string): string {
  const map: Record<string, string> = {
    NEW_LEAD:           'Nuevo lead',
    HOT_LEAD:           '🔥 Lead HOT',
    NEW_MESSAGE:        'Nuevo mensaje',
    DUPLICATE_DETECTED: 'Duplicado detectado',
    MERGE_SUGGESTION:   'Sugerencia de fusión',
  }
  return map[type] ?? 'Notificación'
}

function getBody(type: string, payload: Record<string, unknown>): string {
  const name = (payload.leadName as string | undefined) ?? 'Lead'
  if (type === 'NEW_LEAD')           return `${name} se registró como nuevo lead`
  if (type === 'HOT_LEAD')           return `${name} — score ${payload.score ?? ''} ¡Actúa ahora!`
  if (type === 'NEW_MESSAGE')        return `Nuevo mensaje de ${name}`
  if (type === 'DUPLICATE_DETECTED') return `${name} parece ser un duplicado`
  return 'Nueva notificación en KodevonCRM'
}

const ICON_MAP: Record<string, React.ReactNode> = {
  NEW_LEAD:           <Bell size={16} className="text-brand" />,
  HOT_LEAD:           <Flame size={16} className="text-score-hot" />,
  NEW_MESSAGE:        <MessageCircle size={16} className="text-green-400" />,
  DUPLICATE_DETECTED: <Copy size={16} className="text-amber-400" />,
  MERGE_SUGGESTION:   <GitMerge size={16} className="text-purple-400" />,
}

// ─── Web Push ─────────────────────────────────────────────────

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const API_BASE  = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return new Uint8Array(Array.from(raw).map((c) => c.charCodeAt(0)))
}

async function registerPush(): Promise<void> {
  if (!VAPID_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
    })

    await fetch(`${API_BASE}/api/push/subscribe`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(sub.toJSON()),
    })
  } catch {
    // Web Push no disponible o usuario rechazó permisos — silencioso
  }
}

// ─── SocketProvider component ─────────────────────────────────

export default function SocketProvider() {
  const user            = useAuthStore((s) => s.user)
  const { mutate }      = useSWRConfig()
  const socketRef       = useRef<Socket | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Registrar Web Push al montar (con usuario autenticado)
  useEffect(() => {
    if (user) registerPush()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Conectar Socket.io
  useEffect(() => {
    if (!user) return

    const socket = io(API_BASE, {
      path:              '/socket.io',
      withCredentials:   true,
      auth:              { userId: user.id },
      transports:        ['websocket', 'polling'],
      reconnectionDelay: 2000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[socket] Conectado como', user.id)
    })

    socket.on('notification', (event: NotificationEvent) => {
      const { type, leadId, payload } = event

      // Invalidar caché SWR de notificaciones para actualizar badge
      mutate('/api/notifications')

      // Si es mensaje nuevo, invalidar también el inbox
      if (type === 'NEW_MESSAGE' || type === 'NEW_LEAD') {
        mutate((key) => typeof key === 'string' && key.startsWith('/api/inbox'))
      }

      // Mostrar toast
      const toast: Toast = {
        id:     crypto.randomUUID(),
        type,
        title:  getTitle(type),
        body:   getBody(type, payload),
        leadId,
      }
      setToasts((prev) => [toast, ...prev].slice(0, 5)) // máximo 5 toasts
      playSound()

      // Auto-dismiss a los 6 segundos
      setTimeout(() => removeToast(toast.id), 6000)
    })

    socket.on('disconnect', (reason) => {
      console.log('[socket] Desconectado:', reason)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-surface-raised border border-surface-border rounded-lg shadow-lg p-3 flex gap-3 items-start animate-slide-in"
        >
          <div className="mt-0.5 shrink-0">
            {ICON_MAP[toast.type] ?? <Bell size={16} className="text-gray-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white leading-tight">{toast.title}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">{toast.body}</p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
