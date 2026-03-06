import type { Job } from 'bullmq'
import type { AiSummaryPayload } from '@kodevon/shared'
import { prisma }                from '../lib/prisma'
import { generate, isAvailable } from '../lib/ollama'
import { scoreToLabel }          from '../lib/utils'

function buildSummaryPrompt(params: {
  name: string
  channel: string
  score: number
  conversation: string
}): string {
  return `Genera un resumen ejecutivo en español (máximo 3 oraciones) de esta conversación con un lead calificado de Kodevon.

El resumen debe incluir:
1. Qué necesita o busca el lead
2. Su nivel de interés
3. El siguiente paso recomendado para cerrar la venta

Lead: ${params.name}
Canal: ${params.channel}
Score de intención: ${params.score}/10

Conversación:
${params.conversation}

Escribe únicamente el resumen, sin títulos, listas ni formato adicional:`
}

export async function handleAiSummary(job: Job<AiSummaryPayload>): Promise<void> {
  const { leadId } = job.data

  if (!await isAvailable()) {
    console.warn('[ai-summary] Ollama no disponible — skip')
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
      aiScores: {
        orderBy: { createdAt: 'desc' },
        take:    1,
      },
    },
  })

  if (!lead) return

  const allMessages = lead.conversations
    .flatMap((c) => c.messages)
    .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())

  const conversationText = allMessages
    .map((m) => `${m.direction === 'INBOUND' ? 'Lead' : 'Agente'}: ${m.content}`)
    .join('\n')

  if (!conversationText.trim()) {
    console.log(`[ai-summary] Sin conversación para lead ${leadId} — skip`)
    return
  }

  const currentScore = lead.aiScores[0]?.score ?? lead.score

  const prompt  = buildSummaryPrompt({
    name:         lead.name,
    channel:      lead.sourceChannel,
    score:        currentScore,
    conversation: conversationText,
  })

  const summary = await generate(prompt, 300)

  if (!summary.trim()) return

  // Guardar summary: actualizar el último ai_score o crear uno nuevo
  if (lead.aiScores[0]) {
    await prisma.aiScore.update({
      where: { id: lead.aiScores[0].id },
      data:  { summary: summary.trim() },
    })
  } else {
    await prisma.aiScore.create({
      data: {
        leadId,
        score:   currentScore,
        label:   scoreToLabel(currentScore),
        summary: summary.trim(),
      },
    })
  }

  console.log(`[ai-summary] Resumen generado para lead ${leadId} (${lead.name})`)
}
