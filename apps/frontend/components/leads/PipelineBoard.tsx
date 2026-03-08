'use client'

import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import type { Lead } from '../../lib/api'
import Badge from '../ui/Badge'

const STAGES = [
  { key: 'NUEVO',           label: 'Nuevo'          },
  { key: 'CONTACTADO',      label: 'Contactado'     },
  { key: 'CALIFICADO',      label: 'Calificado'     },
  { key: 'PROPUESTA',       label: 'Propuesta'      },
  { key: 'NEGOCIACION',     label: 'Negociación'    },
  { key: 'CERRADO_GANADO',  label: 'Ganado'         },
  { key: 'CERRADO_PERDIDO', label: 'Perdido'        },
]

const STAGE_COLOR: Record<string, string> = {
  NUEVO:           'border-gray-600',
  CONTACTADO:      'border-blue-500',
  CALIFICADO:      'border-purple-500',
  PROPUESTA:       'border-yellow-500',
  NEGOCIACION:     'border-orange-500',
  CERRADO_GANADO:  'border-green-500',
  CERRADO_PERDIDO: 'border-red-500',
}

interface PipelineBoardProps {
  leads: Lead[]
}

export default function PipelineBoard({ leads }: PipelineBoardProps) {
  const router = useRouter()

  return (
    <div className="flex gap-3 h-full overflow-x-auto pb-4 px-4 pt-1">
      {STAGES.map((stage) => {
        const stageLeads = leads.filter((l) => l.stage === stage.key)
        return (
          <div
            key={stage.key}
            className="flex flex-col shrink-0 w-56 xl:w-64"
          >
            <div className={clsx('flex items-center justify-between mb-2 px-1')}>
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                {stage.label}
              </span>
              <span className="text-gray-600 text-xs">{stageLeads.length}</span>
            </div>

            <div className={clsx('flex flex-col gap-2 flex-1 border-t-2 pt-3', STAGE_COLOR[stage.key])}>
              {stageLeads.length === 0 && (
                <div className="border border-dashed border-white/5 rounded-lg h-16 flex items-center justify-center">
                  <span className="text-gray-700 text-xs">Vacío</span>
                </div>
              )}
              {stageLeads.map((lead) => {
                const scoreVariant = (
                  lead.scoreLabel?.toLowerCase() as 'cold' | 'warm' | 'hot'
                ) ?? 'default'
                return (
                  <button
                    key={lead.id}
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    className="card text-left hover:border-brand/30 transition-colors"
                  >
                    <p className="text-white text-xs font-medium truncate">{lead.name}</p>
                    {lead.company && (
                      <p className="text-gray-500 text-xs truncate mt-0.5">{lead.company}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <Badge label={lead.scoreLabel} variant={scoreVariant} />
                      <span className="text-gray-500 text-xs">{lead.score}/10</span>
                    </div>
                    {lead.assignedTo && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="w-4 h-4 rounded-full bg-brand/20 flex items-center justify-center text-xs text-brand">
                          {lead.assignedTo.name[0]?.toUpperCase()}
                        </div>
                        <span className="text-gray-600 text-xs truncate">{lead.assignedTo.name}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
