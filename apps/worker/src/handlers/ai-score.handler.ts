import type { Job } from 'bullmq'
import type { AiScorePayload } from '@kodevon/shared'
import { QUEUE_NAMES, HOT_LEAD_THRESHOLD } from '@kodevon/shared'
import { prisma }        from '../lib/prisma'
import { queues }        from '../lib/queues'
import { generate, isAvailable } from '../lib/ollama'
import { scoreToLabel }  from '../lib/utils'

// ─── Prompts ──────────────────────────────────────────────────

function buildScoringPrompt(params: {
  channel: string
  messageCount: number
  conversation: string
}): string {
  return `Eres un experto en ventas de tecnología para Kodevon, empresa que vende desarrollo de software, agentes de IA y automatizaciones.

Analiza la siguiente conversación con un lead potencial y asígnale una puntuación de intención de compra del 1 al 10.

Criterios:
- 1-3 (COLD): Curiosidad general, sin intención clara de comprar
- 4-7 (WARM): Interés moderado, pregunta sobre servicios o precios
- 8-10 (HOT): Alta intención: menciona presupuesto, fechas, quiere empezar, usa frases como "empecemos", "cuánto cuesta", "quiero contratar", "necesito para", "presupuesto", "cotización"

Datos del lead:
- Canal: ${params.channel}
- Mensajes enviados: ${params.messageCount}

Conversación:
${params.conversation || '(sin mensajes aún — primer contacto)'}

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{"score": <1-10>, "label": "<COLD|WARM|HOT>", "reason": "<razón en máximo 12 palabras>"}`
}

// ─── Parser robusto ───────────────────────────────────────────

function parseScore(raw: string): { score: number; label: string; reason: string } | null {
  const clean = raw.trim()

  // Intento 1: JSON directo
  try {
    return JSON.parse(clean)
  } catch {}

  // Intento 2: extraer bloque JSON de la respuesta
  const jsonMatch = clean.match(/\{[\s\S]*?\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {}
  }

  // Intento 3: extraer score con regex
  const scoreMatch = clean.match(/"?score"?\s*:\s*(\d+)/)
  if (scoreMatch) {
    const score  = Math.min(10, Math.max(1, parseInt(scoreMatch[1])))
    const label  = score >= 8 ? 'HOT' : score >= 4 ? 'WARM' : 'COLD'
    const reason = clean.match(/"?reason"?\s*:\s*"([^"]+)"/)?.[1] ?? 'Análisis parcial'
    return { score, label, reason }
  }

  return null
}

// ─── Handler ──────────────────────────────────────────────────

export async function handleAiScore(job: Job<AiScorePayload>): Promise<void> {
  const { leadId, triggerMessage } = job.data

  if (!await isAvailable()) {
    console.warn('[ai-score] Ollama no disponible — skip')
    return
  }

  const lead = await prisma.lead.findUnique({
    where:   { id: leadId },
    include: {
      conversations: {
        include: {
          messages: { orderBy: { sentAt: 'asc' } },
        },
      },
    },
  })

  if (!lead) return

  // Últimos 20 mensajes para el contexto
  const allMessages = lead.conversations
    .flatMap((c) => c.messages)
    .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
    .slice(-20)

  const inboundCount = allMessages.filter((m) => m.direction === 'INBOUND').length

  const conversationText = allMessages
    .map((m) => `${m.direction === 'INBOUND' ? 'Lead' : 'Agente'}: ${m.content}`)
    .join('\n')

  const prompt = buildScoringPrompt({
    channel:      lead.sourceChannel,
    messageCount: inboundCount,
    conversation: conversationText || triggerMessage || '',
  })

  const raw    = await generate(prompt, 200)
  const parsed = parseScore(raw)

  if (!parsed) {
    console.warn(`[ai-score] No se pudo parsear respuesta para lead ${leadId}:`, raw.slice(0, 100))
    return
  }

  const score = Math.min(10, Math.max(1, parsed.score))
  const label = scoreToLabel(score)
  const previousScore = lead.score

  // Guardar en historial
  await prisma.aiScore.create({
    data: {
      leadId,
      score,
      label,
      factors:    { reason: parsed.reason, messageCount: inboundCount },
      triggerMsg: triggerMessage?.slice(0, 200),
    },
  })

  // Actualizar lead
  await prisma.lead.update({
    where: { id: leadId },
    data:  { score, scoreLabel: label },
  })

  console.log(`[ai-score] Lead ${leadId}: ${score}/10 (${label}) — ${parsed.reason}`)

  // Cruzó umbral HOT por primera vez
  if (score >= HOT_LEAD_THRESHOLD && previousScore < HOT_LEAD_THRESHOLD) {
    console.log(`[ai-score] 🔥 Lead HOT: ${lead.name} (${score}/10)`)
    await Promise.all([
      queues.aiSummary.add(QUEUE_NAMES.AI_SUMMARY, { leadId }),
      queues.notify.add(QUEUE_NAMES.NOTIFY, {
        type:    'HOT_LEAD',
        leadId,
        payload: { leadName: lead.name, score, reason: parsed.reason, channel: lead.sourceChannel },
      }),
    ])
  }
}
