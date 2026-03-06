import { Queue } from 'bullmq'
import { QUEUE_NAMES } from '@kodevon/shared'
import { bullConnection } from './redis'

const makeQueue = (name: string) =>
  new Queue(name, {
    connection: bullConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  })

export const queues = {
  inboundMessage: makeQueue(QUEUE_NAMES.INBOUND_MESSAGE),
  aiScore:        makeQueue(QUEUE_NAMES.AI_SCORE),
  aiSummary:      makeQueue(QUEUE_NAMES.AI_SUMMARY),
  dedupCheck:     makeQueue(QUEUE_NAMES.DEDUP_CHECK),
  notify:         makeQueue(QUEUE_NAMES.NOTIFY),
  espocrmSync:    makeQueue(QUEUE_NAMES.ESPOCRM_SYNC),
}
