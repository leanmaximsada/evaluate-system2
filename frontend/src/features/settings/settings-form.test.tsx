import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import type { SettingsData } from '@/types'
import { SettingsForm } from './settings-form'

const initial: SettingsData = {
  general: { system_name: 'Evaluation System', default_language: 'en', timezone: 'UTC', date_format: 'Y-m-d', time_format: '24h', pagination_size: 15 },
  evaluation: {
    min_score: 0, max_score: 100, score_precision: 2, tie_policy: 'standard',
    show_tie_indicator: true, live_provisional_enabled: true, default_result_visibility: 'rank_and_score',
  },
}

describe('SettingsForm', () => {
  it('disables save until something changes', () => {
    render(<SettingsForm initial={initial} onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
  })

  it('rejects a maximum score that is not above the minimum', async () => {
    const onSubmit = vi.fn()
    render(<SettingsForm initial={initial} onSubmit={onSubmit} />)

    const max = screen.getByLabelText('Maximum score')
    await userEvent.clear(max)
    await userEvent.type(max, '0')
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))

    expect(await screen.findByText('Maximum score must be greater than minimum')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits changed values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<SettingsForm initial={initial} onSubmit={onSubmit} />)

    const name = screen.getByLabelText('System name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Science Fair')
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ general: expect.objectContaining({ system_name: 'Science Fair' }) }),
    )
  })
})