'use client'

import { useState } from 'react'
import { Check, RefreshCw, ExternalLink, Trash2, Plus } from 'lucide-react'
import Header from '../../../components/layout/Header'
import { useEspocrmStatus, useGmailStatus, useUsers } from '../../../lib/hooks'
import { api } from '../../../lib/api'
import { useAuthStore } from '../../../store/auth.store'
import { mutate } from 'swr'

export default function SettingsPage() {
  const { user }                    = useAuthStore()
  const { data: espocrm }           = useEspocrmStatus()
  const { data: gmail }             = useGmailStatus()
  const { data: usersData }         = useUsers()

  const [syncingEspo, setSyncingEspo] = useState(false)
  const [newUser, setNewUser]          = useState({ name: '', email: '', password: '', role: 'AGENT' })
  const [creatingUser, setCreatingUser] = useState(false)
  const [showNewUser, setShowNewUser]  = useState(false)

  async function syncAllEspocrm() {
    setSyncingEspo(true)
    try {
      await api.espocrm.syncAll()
    } catch {}
    setSyncingEspo(false)
  }

  async function connectGmail() {
    try {
      const { url } = await api.gmail.getAuthUrl()
      window.open(url, '_blank')
    } catch (err) {
      console.error(err)
    }
  }

  async function disconnectGmail() {
    await api.gmail.disconnect()
    mutate('gmail-status')
  }

  async function createUser() {
    setCreatingUser(true)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      setNewUser({ name: '', email: '', password: '', role: 'AGENT' })
      setShowNewUser(false)
      mutate('users')
    } catch (err) {
      console.error(err)
    } finally {
      setCreatingUser(false)
    }
  }

  const isAdmin = user?.role === 'ADMIN'

  return (
    <div className="flex flex-col h-full">
      <Header title="Ajustes" />
      <div className="flex-1 overflow-auto p-6 max-w-2xl mx-auto w-full space-y-6">

        {/* EspoCRM */}
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-medium text-sm">EspoCRM</h2>
              <p className="text-gray-500 text-xs mt-0.5">Sincronización con el CRM interno</p>
            </div>
            <div className="flex items-center gap-2">
              {espocrm?.connected ? (
                <span className="flex items-center gap-1.5 text-green-400 text-xs">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Conectado
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-red-400 text-xs">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full" /> Desconectado
                </span>
              )}
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={syncAllEspocrm}
              disabled={syncingEspo}
              className="btn-ghost text-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingEspo ? 'animate-spin' : ''}`} />
              {syncingEspo ? 'Sincronizando...' : 'Sincronizar todos los leads'}
            </button>
          )}
        </section>

        {/* Gmail */}
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-medium text-sm">Gmail</h2>
              <p className="text-gray-500 text-xs mt-0.5">
                {gmail?.connected ? `Conectado como ${gmail.email}` : 'Sin conectar'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {gmail?.connected ? (
                <>
                  <span className="flex items-center gap-1.5 text-green-400 text-xs">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Activo
                  </span>
                  {isAdmin && (
                    <button onClick={disconnectGmail} className="btn-ghost text-xs text-red-400 hover:text-red-300">
                      <Trash2 className="w-3.5 h-3.5" /> Desconectar
                    </button>
                  )}
                </>
              ) : (
                isAdmin && (
                  <button onClick={connectGmail} className="btn-primary text-sm">
                    <ExternalLink className="w-3.5 h-3.5" /> Conectar Gmail
                  </button>
                )
              )}
            </div>
          </div>
          {gmail?.connected && (
            <p className="text-gray-500 text-xs">
              Polling activo · cada 2 minutos · solo correos no leídos
            </p>
          )}
        </section>

        {/* Canales */}
        <section className="card space-y-3">
          <h2 className="text-white font-medium text-sm">Canales activos</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'WhatsApp',  note: 'Meta Cloud API' },
              { label: 'Instagram', note: 'Meta Cloud API' },
              { label: 'Facebook',  note: 'Meta Cloud API' },
              { label: 'Gmail',     note: gmail?.connected ? 'OAuth2 activo' : 'Sin configurar' },
              { label: 'Formulario web', note: 'POST /api/leads' },
              { label: 'API pública',    note: 'API Key requerida' },
            ].map(({ label, note }) => (
              <div key={label} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                <span className="text-white">{label}</span>
                <span className="text-gray-500 ml-auto">{note}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Usuarios (solo admin) */}
        {isAdmin && (
          <section className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-medium text-sm">Usuarios</h2>
              <button
                onClick={() => setShowNewUser((v) => !v)}
                className="btn-primary text-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo usuario
              </button>
            </div>

            {showNewUser && (
              <div className="border border-white/10 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs">Nombre</label>
                    <input
                      className="input w-full mt-1 text-sm py-1.5"
                      value={newUser.name}
                      onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs">Email</label>
                    <input
                      type="email"
                      className="input w-full mt-1 text-sm py-1.5"
                      value={newUser.email}
                      onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs">Contraseña</label>
                    <input
                      type="password"
                      className="input w-full mt-1 text-sm py-1.5"
                      value={newUser.password}
                      onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs">Rol</label>
                    <select
                      className="input w-full mt-1 text-sm py-1.5"
                      value={newUser.role}
                      onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
                    >
                      <option value="AGENT">Agente</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createUser}
                    disabled={creatingUser || !newUser.name || !newUser.email || !newUser.password}
                    className="btn-primary text-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {creatingUser ? 'Creando...' : 'Crear'}
                  </button>
                  <button onClick={() => setShowNewUser(false)} className="btn-ghost text-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {(usersData?.users ?? []).map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand">
                    {u.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{u.name}</p>
                    <p className="text-gray-500 text-xs">{u.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.role === 'ADMIN' ? 'bg-brand/10 text-brand' : 'bg-white/5 text-gray-400'
                  }`}>
                    {u.role}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-400' : 'bg-gray-600'}`} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Info */}
        <section className="card space-y-2">
          <h2 className="text-white font-medium text-sm">Sistema</h2>
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Versión</span><span className="text-gray-400">0.7.0</span>
            </div>
            <div className="flex justify-between">
              <span>Stack</span><span className="text-gray-400">Next.js 14 · Fastify · PostgreSQL · BullMQ · Ollama</span>
            </div>
            <div className="flex justify-between">
              <span>Modelo IA</span><span className="text-gray-400">Llama 3.2 3B</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
