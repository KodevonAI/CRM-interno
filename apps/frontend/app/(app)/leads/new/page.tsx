'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Header from '../../../../components/layout/Header'
import { api } from '../../../../lib/api'

const CHANNELS = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'EMAIL', 'FORM', 'API']

export default function NewLeadPage() {
  const router  = useRouter()
  const [form, setForm] = useState({
    name:          '',
    email:         '',
    phone:         '',
    company:       '',
    sourceChannel: 'FORM',
  })
  const [saving, setSaving]  = useState(false)
  const [error, setError]    = useState('')

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name) return
    setSaving(true)
    setError('')
    try {
      const { lead } = await api.leads.create({
        ...form,
        email:   form.email || undefined,
        phone:   form.phone || undefined,
        company: form.company || undefined,
      })
      router.push(`/leads/${lead.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear lead')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Nuevo lead" />
      <div className="flex-1 overflow-auto p-6 max-w-lg mx-auto w-full">
        <button onClick={() => router.push('/leads')} className="btn-ghost text-sm mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver
        </button>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="text-white font-medium">Crear lead manualmente</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-gray-400 text-xs">Nombre *</label>
            <input
              className="input w-full text-sm"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              placeholder="Juan Pérez"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-gray-400 text-xs">Email</label>
              <input
                type="email"
                className="input w-full text-sm"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="juan@empresa.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-gray-400 text-xs">Teléfono</label>
              <input
                className="input w-full text-sm"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+52 55 1234 5678"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-gray-400 text-xs">Empresa</label>
            <input
              className="input w-full text-sm"
              value={form.company}
              onChange={(e) => set('company', e.target.value)}
              placeholder="Empresa S.A."
            />
          </div>

          <div className="space-y-1">
            <label className="text-gray-400 text-xs">Canal de origen</label>
            <select
              className="input w-full text-sm"
              value={form.sourceChannel}
              onChange={(e) => set('sourceChannel', e.target.value)}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={saving || !form.name}
            className="btn-primary w-full justify-center"
          >
            {saving ? 'Creando...' : 'Crear lead'}
          </button>
        </form>
      </div>
    </div>
  )
}
