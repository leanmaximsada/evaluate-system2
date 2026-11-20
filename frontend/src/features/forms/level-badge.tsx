'use client'

import { useI18n } from '@/i18n/provider'
import type { LevelRef, RubricLevel } from '@/types'
import { LEVEL_TONE, bandOf, levelName } from './rubric'

export function LevelBadge({ level }: { level: LevelRef }) {
  const { locale } = useI18n()

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${LEVEL_TONE[level.color] ?? LEVEL_TONE.slate}`}>
      {levelName(level, locale)}
    </span>
  )
}

/** "75% to under 90%", or "90% to 100%" for the top level. */
export function BandLabel({ levels, level }: { levels: RubricLevel[]; level: RubricLevel }) {
  const { t } = useI18n()
  const { lower, upper } = bandOf(levels, level)

  return <>{upper >= 100 ? t('rubric.band_top', { min: lower }) : t('rubric.band_range', { min: lower, max: upper })}</>
}