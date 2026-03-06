import { Queue } from 'bullmq'
import { QUEUE_NAMES } from '@kodevon/shared'
import { connection } from './redis'

const make = (name: string) =>
  new Queue(name, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail:     { count: 50 },
    },
  })

export const queues = {
  inboundMessage: make(QUEUE_NAMES.INBOUND_MESSAGE),
  aiScore:        make(QUEUE_NAMES.AI_SCORE),
  aiSummary:      make(QUEUE_NAMES.AI_SUMMARY),
  dedupCheck:     make(QUEUE_NAMES.DEDUP_CHECK),
  notify:         make(QUEUE_NAMES.NOTIFY),
  espocrmSync:    make(QUEUE_NAMES.ESPOCRM_SYNC),
  gmailPoll:      make(QUEUE_NAMES.GMAIL_POLL),
}
