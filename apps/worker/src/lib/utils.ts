import { SCORE_THRESHOLDS } from '@kodevon/shared'
import type { ScoreLabel } from '@kodevon/shared'

export function scoreToLabel(score: number): ScoreLabel {
  if (score >= SCORE_THRESHOLDS.HOT.min)  return 'HOT'
  if (score >= SCORE_THRESHOLDS.WARM.min) return 'WARM'
  return 'COLD'
}
