'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit2, Check, X, RefreshCw } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import Header from '../../../../components/layout/Header'
import Badge from '../../../../components/ui/Badge'
import { useLead, useUsers } from '../../../../lib/hooks'
import { api } from '../../../../lib/api'
import { mutate } from 'swr'

const STAGES = [
  'NUEVO', 'CONTACTADO', 'CALIFICADO', 'PROPUESTA',
  'NEGOCIACION', 'CERRADO_GANADO', 'CERRADO_PERDIDO',
]

export default function LeadDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const { data, isLoading } = useLead(id)
  const { data: usersData } = useUsers()

  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState<Record<string, string>>({})
  const [saving, setSaving]   = useState(false)
  const [syncing, setSyncing] = useState(false)

  const lead  = data?.lead
  const users = usersData?.users ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Lead" />
        <div className="flex items-center justify-center flex-1 text-gray-500 text-sm">
          Cargando...
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Lead" />
        <div className="flex items-center justify-center flex-1 text-gray-500 text-sm">
          Lead no encontrado
        </div>
      </div>
    )
  }

  const scoreVariant = (lead.scoreLabel?.toLowerCase() as 'cold' | 'warm' | 'hot') ?? 'default'

  function startEdit() {
    setForm({
      name:     lead!.name,
      email:    lead!.email ?? '',
      phone:    lead!.phone ?? '',
      company:  lead!.company ?? '',
      stage:    lead!.stage,
      assignedToId: lead!.assignedTo?.id ?? '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      await api.leads.update(lead!.id, {
        name:    form.name,
        email:   form.email || undefined,
        phone:   form.phone || undefined,
        company: form.company || undefined,
        stage:   form.stage as never,
      })
      if (form.assignedToId) {
        await api.leads.assign(lead!.id, form.assignedToId)
      }
      mutate(['lead', id])
      setEditing(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function syncEspocrm() {
    setSyncing(true)
    try {
      await api.espocrm.syncAll()
    } catch {}
    setSyncing(false)
  }

  const lastScore = lead.aiScores?.[0]

  return (
    <div className="flex flex-col h-full">
      <Header title="Detalle del lead" />
      <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full">
        {/* Back */}
        <button
          onClick={() => router.push('/leads')}
          className="btn-ghost text-sm mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main card */}
          <div className="lg:col-span-2 card space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-white font-semibold text-lg">{lead.name}</h2>
                <p className="text-gray-500 text-sm">{lead.sourceChannel}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge label={lead.scoreLabel} variant={scoreVariant} />
                {!editing && (
                  <button onClick={startEdit} className="btn-ghost text-xs">
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                )}
                {editing && (
                  <>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="btn-primary text-xs"
                    >
                      <Check className="w-3.5 h-3.5" /> {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="btn-ghost text-xs"
                    >
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Nombre',   field: 'name',    value: lead.name    },
                { label: 'Email',    field: 'email',   value: lead.email   },
                { label: 'Teléfono', field: 'phone',   value: lead.phone   },
                { label: 'Empresa',  field: 'company', value: lead.company },
              ].map(({ label, field, value }) => (
                <div key={field}>
                  <p className="text-gray-500 text-xs mb-1">{label}</p>
                  {editing ? (
                    <input
                      className="input w-full text-sm py-1.5"
                      value={form[field] ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    />
                  ) : (
                    <p className="text-white text-sm">{value ?? '—'}</p>
                  )}
                </div>
              ))}

              <div>
                <p className="text-gray-500 text-xs mb-1">Etapa</p>
                {editing ? (
                  <select
                    className="input w-full text-sm py-1.5"
                    value={form.stage}
                    onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-white text-sm">{lead.stage}</p>
                )}
              </div>

              <div>
                <p className="text-gray-500 text-xs mb-1">Asignado a</p>
                {editing ? (
                  <select
                    className="input w-full text-sm py-1.5"
                    value={form.assignedToId}
                    onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))}
                  >
                    <option value="">Sin asignar</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-white text-sm">{lead.assignedTo?.name ?? '—'}</p>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center gap-4 text-xs text-gray-500">
              <span>Creado {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true, locale: es })}</span>
              {lead.isDuplicate && (
                <span className="text-yellow-400">Posible duplicado</span>
              )}
            </div>
          </div>

          {/* AI Score */}
          <div className="space-y-4">
            <div className="card space-y-3">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Score IA</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-white">{lead.score}</span>
                <span className="text-gray-500 text-sm pb-1">/10</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-brand transition-all"
                  style={{ width: `${lead.score * 10}%` }}
                />
              </div>
              {lastScore?.summary && (
                <p className="text-gray-400 text-xs leading-relaxed">{lastScore.summary}</p>
              )}
            </div>

            {/* Historial scores */}
            {lead.aiScores && lead.aiScores.length > 0 && (
              <div className="card space-y-2">
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Historial IA</p>
                {lead.aiScores.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      {format(new Date(s.createdAt), 'dd/MM HH:mm')}
                    </span>
                    <Badge
                      label={`${s.score}/10`}
                      variant={s.label.toLowerCase() as 'cold' | 'warm' | 'hot'}
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={syncEspocrm}
              disabled={syncing}
              className="btn-ghost w-full text-xs justify-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sync EspoCRM'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
