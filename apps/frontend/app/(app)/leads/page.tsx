'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutGrid, List, Search, Plus, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { clsx } from 'clsx'
import Header from '../../../components/layout/Header'
import PipelineBoard from '../../../components/leads/PipelineBoard'
import Badge from '../../../components/ui/Badge'
import { useLeads } from '../../../lib/hooks'
import { api } from '../../../lib/api'
import { mutate } from 'swr'

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP:  'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK:  'Facebook',
  EMAIL:     'Email',
  FORM:      'Formulario',
  API:       'API',
}

export default function LeadsPage() {
  const router             = useRouter()
  const [view, setView]    = useState<'table' | 'pipeline'>('table')
  const [search, setSearch] = useState('')
  const [page, setPage]    = useState(1)
  const { data, isLoading } = useLeads({ page, limit: 50, search })

  const leads = data?.data ?? []
  const pagination = data?.pagination

  const filtered = search
    ? leads.filter(
        (l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.email?.toLowerCase().includes(search.toLowerCase()) ||
          l.phone?.includes(search),
      )
    : leads

  return (
    <div className="flex flex-col h-full">
      <Header title="Leads" />

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            className="input w-full pl-9 py-2 text-sm"
            placeholder="Buscar leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setView('table')}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              view === 'table' ? 'bg-brand/10 text-brand' : 'text-gray-400 hover:text-white hover:bg-white/5',
            )}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('pipeline')}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              view === 'pipeline' ? 'bg-brand/10 text-brand' : 'text-gray-400 hover:text-white hover:bg-white/5',
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => router.push('/leads/new')}
          className="btn-primary text-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo lead
        </button>
      </div>

      {/* Content */}
      {view === 'pipeline' ? (
        <div className="flex-1 overflow-hidden pt-3">
          <PipelineBoard leads={filtered} />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
              Cargando...
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              No hay leads
            </div>
          )}
          {filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-2 border-b border-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Lead</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Canal</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Etapa</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Score</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Asignado</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Creado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const scoreVariant = (
                    lead.scoreLabel?.toLowerCase() as 'cold' | 'warm' | 'hot'
                  ) ?? 'default'
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{lead.name}</p>
                        {lead.email && <p className="text-gray-500 text-xs">{lead.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {CHANNEL_LABEL[lead.sourceChannel] ?? lead.sourceChannel}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{lead.stage}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge label={lead.scoreLabel} variant={scoreVariant} />
                          <span className="text-gray-500 text-xs">{lead.score}/10</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {lead.assignedTo?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true, locale: es })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-3 py-4 border-t border-white/5">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-ghost text-sm disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-gray-500 text-sm">
                {page} / {pagination.pages}
              </span>
              <button
                disabled={page === pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-ghost text-sm disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
