'use client'

import { useI18n } from '@/i18n/provider'
import type { RubricLevel } from '@/types'
import { BandLabel, LevelBadge } from './level-badge'
import { LEVEL_TONE, levelFor, levelName, sortLevels, suggestedScore } from './rubric'

interface Props {
  rubric?: RubricLevel[] | null
  criterion: { id: number; min_score: number; max_score: number }
  value: string
  disabled: boolean
  onPick: (value: string) => void
}

export function RubricHelper({ rubric, criterion, value, disabled, onPick }: Props) {
  const { t, locale } = useI18n()
  if (!rubric || rubric.length === 0) return null

  const levels = sortLevels(rubric)
  const typed = Number(value)
  const current = value.trim() !== '' && Number.isFinite(typed) ? levelFor(rubric, criterion, typed) : null
  const description = current?.descriptions[String(criterion.id)]

  return (
    <div className="mt-3 space-y-2">
      {!disabled && (
        <div role="group" aria-label={t('rubric.pick_hint')} className="flex flex-wrap gap-2">
          {levels.map((level) => (
            <button
              key={level.min_percent}
              type="button"
              onClick={() => onPick(String(suggestedScore(rubric, level, criterion)))}
              className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset hover:opacity-80 ${LEVEL_TONE[level.color]}`}
            >
              {levelName(level, locale)}
            </button>
          ))}
        </div>
      )}

      {current && (
        <p className="flex flex-wrap items-center gap-2">
          <span data-testid={`level-${criterion.id}`}><LevelBadge level={current} /></span>
          {description && <span className="text-sm text-slate-600">{description}</span>}
        </p>
      )}

      <details>
        <summary className="cursor-pointer text-sm font-medium text-slate-700">{t('rubric.guide')}</summary>
        <ul className="mt-2 space-y-2">
          {levels.map((level) => (
            <li key={level.min_percent} className="flex flex-wrap items-baseline gap-2 text-sm">
              <LevelBadge level={level} />
              <span className="text-slate-500"><BandLabel levels={rubric} level={level} /></span>
              {level.descriptions[String(criterion.id)] && <span className="text-slate-700">{level.descriptions[String(criterion.id)]}</span>}
            </li>
          ))}
        </ul>
        {!disabled && <p className="mt-2 text-xs text-slate-500">{t('rubric.pick_hint')}</p>}
      </details>
    </div>
  )
}