import { describe, expect, it } from 'vitest'
import type { RubricLevel } from '@/types'
import { levelFor, levelName, suggestedScore, validateRubric } from './rubric'

const level = (name: string, min: string, color: RubricLevel['color'] = 'slate'): RubricLevel => ({ name, name_km: null, min_percent: min, color, descriptions: {} })
const levels = [level('Needs Improvement', '0'), level('Superior', '90'), level('Good', '50'), level('Excellent', '75')]
const hundred = { min_score: 0, max_score: 100 }

describe('rubric helpers', () => {
  it('finds the highest level a score reaches, whatever the range', () => {
    expect(levelFor(levels, hundred, 90)?.name).toBe('Superior')
    expect(levelFor(levels, hundred, 89.99)?.name).toBe('Excellent')
    expect(levelFor(levels, hundred, 74.99)?.name).toBe('Good')
    expect(levelFor(levels, hundred, 0)?.name).toBe('Needs Improvement')
    expect(levelFor(levels, { min_score: 0, max_score: 10 }, 9)?.name).toBe('Superior')
    expect(levelFor(levels, { min_score: 1, max_score: 5 }, 3)?.name).toBe('Good')
    expect(levelFor(levels, hundred, Number.NaN)).toBeNull()
  })

  it('suggests the middle of the level band', () => {
    expect(suggestedScore(levels, levels[1], hundred)).toBe(95)
    expect(suggestedScore(levels, levels[3], hundred)).toBe(82.5)
    expect(suggestedScore(levels, levels[0], hundred)).toBe(25)
    expect(suggestedScore(levels, levels[1], { min_score: 0, max_score: 10 })).toBe(9.5)
  })

  it('uses the Khmer name when the language is Khmer and one exists', () => {
    expect(levelName({ name: 'Good', name_km: 'ល្អ' }, 'km')).toBe('ល្អ')
    expect(levelName({ name: 'Good', name_km: null }, 'km')).toBe('Good')
    expect(levelName({ name: 'Good', name_km: 'ល្អ' }, 'en')).toBe('Good')
  })

  it('validates a rubric', () => {
    expect(validateRubric([])).toBeNull()
    expect(validateRubric(levels)).toBeNull()
    expect(validateRubric([levels[0]])).toBe('rubric.err_count')
    expect(validateRubric([{ name: '', min_percent: '0' }, { name: 'B', min_percent: '50' }])).toBe('rubric.err_name')
    expect(validateRubric([{ name: 'A', min_percent: '0' }, { name: 'B', min_percent: '150' }])).toBe('rubric.err_percent')
    expect(validateRubric([{ name: 'A', min_percent: '0' }, { name: 'B', min_percent: '0' }])).toBe('rubric.err_unique')
    expect(validateRubric([{ name: 'A', min_percent: '10' }, { name: 'B', min_percent: '50' }])).toBe('rubric.err_zero')
  })
})