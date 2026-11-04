import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import type { Criterion } from '@/types'
import { ScoreForm } from './score-form'

const criterion = (id: number, name: string, required = true): Criterion => ({
  id, name, description: null, min_score: 0, max_score: 100, weight: 50, display_order: id, is_required: required, is_active: true,
})
const criteria = [criterion(1, 'Content'), criterion(2, 'Delivery')]

function setup(props: Partial<React.ComponentProps<typeof ScoreForm>> = {}) {
  const onSaveDraft = vi.fn().mockResolvedValue(undefined)
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<ScoreForm criteria={criteria} initial={{}} weighted readOnly={false} onSaveDraft={onSaveDraft} onSubmit={onSubmit} {...props} />)
  return { onSaveDraft, onSubmit }
}

describe('ScoreForm', () => {
  it('will not submit while a required score is missing', async () => {
    const { onSubmit } = setup()

    await userEvent.type(screen.getByLabelText('Content'), '80')
    await userEvent.click(screen.getByRole('button', { name: 'Submit scores' }))

    expect(await screen.findByText('Enter a score')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a score outside the criterion range', async () => {
    const { onSaveDraft } = setup()

    await userEvent.type(screen.getByLabelText('Content'), '150')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('Score must be between 0 and 100')).toBeInTheDocument()
    expect(onSaveDraft).not.toHaveBeenCalled()
  })

  it('saves a draft with only the filled scores', async () => {
    const { onSaveDraft } = setup()

    await userEvent.type(screen.getByLabelText('Content'), '80.5')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(onSaveDraft).toHaveBeenCalledWith({ 1: '80.5' })
    expect(await screen.findByText('Draft saved.')).toBeInTheDocument()
  })

  it('asks for confirmation before submitting', async () => {
    const { onSubmit } = setup()

    await userEvent.type(screen.getByLabelText('Content'), '80')
    await userEvent.type(screen.getByLabelText('Delivery'), '90')
    await userEvent.click(screen.getByRole('button', { name: 'Submit scores' }))

    expect(await screen.findByText('Submit these scores?')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    await userEvent.click(screen.getByText('Confirm and submit'))
    expect(onSubmit).toHaveBeenCalledWith({ 1: '80', 2: '90' })
  })

  it('is read-only after submission', () => {
    setup({ readOnly: true, initial: { 1: '80.00', 2: '90.00' } })

    expect(screen.getByLabelText('Content')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Submit scores' })).not.toBeInTheDocument()
    expect(screen.getByText(/cannot be changed/)).toBeInTheDocument()
  })
})