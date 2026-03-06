import 'dotenv/config'
import { Worker } from 'bullmq'
import { QUEUE_NAMES } from '@kodevon/shared'
import { connection }             from './lib/redis'
import { queues }                 from './lib/queues'
import { handleInboundMessage }   from './handlers/inbound-message.handler'
import { handleEspocrmSync }      from './handlers/espocrm.handler'
import { handleGmailPoll }        from './handlers/gmail-poll.handler'
import { handleDedupCheck }       from './handlers/dedup-check.handler'
import { handleNotify }           from './handlers/notify.handler'
import { handleAiScore }          from './handlers/ai-score.handler'
import { handleAiSummary }        from './handlers/ai-summary.handler'

const opts = { connection }

// ─── Workers — todos con handlers reales ─────────────────────

const workers = [
  new Worker(QUEUE_NAMES.INBOUND_MESSAGE, handleInboundMessage, opts),
  new Worker(QUEUE_NAMES.ESPOCRM_SYNC,    handleEspocrmSync,    opts),
  new Worker(QUEUE_NAMES.GMAIL_POLL,      handleGmailPoll,      opts),
  new Worker(QUEUE_NAMES.DEDUP_CHECK,     handleDedupCheck,     opts),
  new Worker(QUEUE_NAMES.NOTIFY,          handleNotify,         opts),
  new Worker(QUEUE_NAMES.AI_SCORE,        handleAiScore,        opts),
  new Worker(QUEUE_NAMES.AI_SUMMARY,      handleAiSummary,      opts),
]

// ─── Logging ──────────────────────────────────────────────────

workers.forEach((w) => {
  w.on('completed', (job) =>
    console.log(`[worker] ✓ ${w.name} #${job.id}`)
  )
  w.on('failed', (job, err) =>
    console.error(`[worker] ✗ ${w.name} #${job?.id} — ${err.message}`)
  )
})

// ─── Gmail polling recurrente (cada 2 minutos) ────────────────

queues.gmailPoll
  .upsertJobScheduler('gmail-poll-recurring', { every: 2 * 60 * 1000 }, {
    name: QUEUE_NAMES.GMAIL_POLL,
    data: {},
  })
  .then(() => console.log('[worker] Gmail polling cada 2 min registrado'))
  .catch((err: Error) => console.error('[worker] Error registrando Gmail poll:', err.message))

// ─── Status ───────────────────────────────────────────────────

console.log('[worker] KodevonCRM worker iniciado — todos los handlers activos')
console.log(`[worker] inbound ✅ | espocrm ✅ | gmail ✅ | dedup ✅ | notify ✅ | ai-score ✅ | ai-summary ✅`)

// ─── Graceful shutdown ────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.log(`\n[worker] ${signal} — cerrando...`)
  await Promise.all(workers.map((w) => w.close()))
  connection.disconnect()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
