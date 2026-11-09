import { describe, it, expect } from 'vitest'
import { ordinal } from './ordinal'

describe('ordinal', () => {
  it('formats English ordinals including the teens', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 112].map((n) => ordinal('en', n)))
      .toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '112th'])
  })

  it('formats Khmer ordinals', () => {
    expect(ordinal('km', 1)).toBe('ទី 1')
  })
})