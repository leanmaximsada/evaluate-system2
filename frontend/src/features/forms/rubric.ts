import type { Locale } from '@/i18n/core'
import type { LevelRef, RubricColor, RubricLevel } from '@/types'

export const RUBRIC_COLORS: RubricColor[] = ['green', 'blue', 'amber', 'orange', 'red', 'slate', 'purple']
export const MAX_LEVELS = 8

export const LEVEL_TONE: Record<RubricColor, string> = {
  green: 'bg-green-50 text-green-700 ring-green-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-800',
  red: 'bg-red-50 text-red-700 ring-red-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  purple: 'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:ring-purple-800',
}

/** The default four-level scale. */
export const RUBRIC_PRESET: Omit<RubricLevel, 'descriptions'>[] = [
  { name: 'Superior', name_km: 'ឆ្នើមបំផុត', min_percent: '90', color: 'green' },
  { name: 'Excellent', name_km: 'ល្អប្រសើរ', min_percent: '75', color: 'blue' },
  { name: 'Good', name_km: 'ល្អ', min_percent: '50', color: 'amber' },
  { name: 'Needs Improvement', name_km: 'ត្រូវកែលម្អ', min_percent: '0', color: 'red' },
]

/** Highest level first. */
export function sortLevels<T extends { min_percent: string }>(levels: T[]): T[] {
  return [...levels].sort((a, b) => Number(b.min_percent) - Number(a.min_percent))
}

export function levelName(level: Pick<LevelRef, 'name' | 'name_km'>, locale: Locale): string {
  return locale === 'km' && level.name_km ? level.name_km : level.name
}

interface Range {
  min_score: number
  max_score: number
}

/** The highest level whose starting percentage the score reaches. A guide only; the server decides stored labels. */
export function levelFor(levels: RubricLevel[], criterion: Range, score: number): RubricLevel | null {
  const range = criterion.max_score - criterion.min_score
  if (!(range > 0) || !Number.isFinite(score)) return null

  const percent = ((score - criterion.min_score) * 100) / range
  return sortLevels(levels).find((level) => percent + 1e-9 >= Number(level.min_percent)) ?? null
}

/** Where a level's band starts and ends (the next higher level's start, or 100). */
export function bandOf(levels: RubricLevel[], level: RubricLevel): { lower: number; upper: number } {
  const sorted = sortLevels(levels)
  const index = sorted.findIndex((l) => Number(l.min_percent) === Number(level.min_percent))

  return { lower: Number(level.min_percent), upper: index > 0 ? Number(sorted[index - 1].min_percent) : 100 }
}

/** The middle of the level's band, as a score for this criterion. */
export function suggestedScore(levels: RubricLevel[], level: RubricLevel, criterion: Range): number {
  const { lower, upper } = bandOf(levels, level)
  const middle = (lower + upper) / 2
  const raw = criterion.min_score + ((criterion.max_score - criterion.min_score) * middle) / 100

  return Math.round(raw * 100) / 100
}

/** Returns a message key, or null when the levels are valid. An empty list is valid (no rubric). */
export function validateRubric(levels: { name: string; min_percent: string }[]): string | null {
  if (levels.length === 0) return null
  if (levels.length < 2 || levels.length > MAX_LEVELS) return 'rubric.err_count'
  if (levels.some((l) => l.name.trim() === '' || l.name.trim().length > 60)) return 'rubric.err_name'

  const percents = levels.map((l) => l.min_percent.trim())
  if (percents.some((p) => !/^\d+(\.\d{1,2})?$/.test(p) || Number(p) > 100)) return 'rubric.err_percent'

  const numbers = percents.map(Number)
  if (new Set(numbers).size !== numbers.length) return 'rubric.err_unique'
  if (!numbers.includes(0)) return 'rubric.err_zero'

  return null
}