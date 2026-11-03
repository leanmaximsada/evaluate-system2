import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CriterionForm } from './criterion-form'

describe('CriterionForm', () => {
  it('requires a name', async () => {
    const onSubmit = vi.fn()
    render(<CriterionForm weighted submitLabel="Add criterion" onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: 'Add criterion' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a maximum that is not above the minimum', async () => {
    const onSubmit = vi.fn()
    render(<CriterionForm weighted submitLabel="Add criterion" onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText('Criterion name'), 'Clarity')
    const max = screen.getByLabelText('Max score')
    await userEvent.clear(max)
    await userEvent.type(max, '0')
    await userEvent.click(screen.getByRole('button', { name: 'Add criterion' }))

    expect(await screen.findByText('Maximum score must be greater than minimum')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('hides the weight for unweighted forms and submits weight 0', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<CriterionForm weighted={false} submitLabel="Add criterion" onSubmit={onSubmit} />)

    expect(screen.queryByLabelText('Weight (%)')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Criterion name'), 'Clarity')
    await userEvent.click(screen.getByRole('button', { name: 'Add criterion' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Clarity', weight: 0, min_score: 0, max_score: 100 }))
  })
})