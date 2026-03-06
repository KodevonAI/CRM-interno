import type { ScoreLabel } from '@kodevon/shared'
import { SCORE_THRESHOLDS } from '@kodevon/shared'

export function scoreToLabel(score: number): ScoreLabel {
  if (score >= SCORE_THRESHOLDS.HOT.min) return 'HOT'
  if (score >= SCORE_THRESHOLDS.WARM.min) return 'WARM'
  return 'COLD'
}

export function paginate(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  }
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}
