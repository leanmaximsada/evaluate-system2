import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PublicRow } from './live-results'
import { DRUM_MS, useRevealedRows } from './use-revealed-rows'

const row = (number: string, rank: number): PublicRow => ({ number, name: `Team ${number}`, team_name: null, rank, tied: false })
const numbers = (rows: PublicRow[]) => rows.map((r) => r.number)

describe('useRevealedRows', () => {
  afterEach(() => vi.useRealTimers())

  it('shows the first load immediately', () => {
    const initial = [row('4', 4)]
    const { result } = renderHook(() => useRevealedRows(initial, true))
    expect(numbers(result.current.rows)).toEqual(['4'])
    expect(result.current.drum).toBe(false)
  })

  it('holds new rows back for the drum roll', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ rows }) => useRevealedRows(rows, true), { initialProps: { rows: [row('4', 4)] as PublicRow[] | undefined } })

    rerender({ rows: [row('1', 1), row('4', 4)] })
    expect(result.current.drum).toBe(true)
    expect(numbers(result.current.rows)).toEqual(['4'])

    act(() => { vi.advanceTimersByTime(DRUM_MS) })
    expect(result.current.drum).toBe(false)
    expect(numbers(result.current.rows)).toEqual(['1', '4'])
    expect(result.current.fresh.has('1')).toBe(true)
  })

  it('shows changes immediately when reveal mode is off', () => {
    const { result, rerender } = renderHook(({ rows }) => useRevealedRows(rows, false), { initialProps: { rows: [row('4', 4)] as PublicRow[] | undefined } })

    rerender({ rows: [row('1', 1), row('4', 4)] })
    expect(numbers(result.current.rows)).toEqual(['1', '4'])
    expect(result.current.drum).toBe(false)
  })
})