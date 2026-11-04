import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PublishDialog } from './publish-dialog'

function setup(props: Partial<React.ComponentProps<typeof PublishDialog>> = {}) {
  const onSubmit = vi.fn()
  render(<PublishDialog open hasPrevious={false} incompleteCount={0} onSubmit={onSubmit} onClose={() => {}} {...props} />)
  return onSubmit
}

describe('PublishDialog', () => {
  it('will not publish until the confirmation box is ticked', async () => {
    const onSubmit = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Publish results' }))

    expect(await screen.findByText('Please confirm before publishing')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('needs a correction reason when republishing', async () => {
    const onSubmit = setup({ hasPrevious: true })

    await userEvent.click(screen.getByLabelText('I confirm these are the final results'))
    await userEvent.click(screen.getByRole('button', { name: 'Publish results' }))
    expect(await screen.findByText('Enter a correction reason')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('Correction reason'), 'Fixed a typo')
    await userEvent.click(screen.getByRole('button', { name: 'Publish results' }))
    expect(onSubmit).toHaveBeenCalledWith({ visibility: 'rank_and_score', confirm: true, correction_reason: 'Fixed a typo' })
  })

  it('sends the chosen visibility and the incomplete-evaluations choice', async () => {
    const onSubmit = setup({ incompleteCount: 2 })

    await userEvent.selectOptions(screen.getByLabelText('What the public will see'), 'rank_only')
    await userEvent.click(screen.getByLabelText(/Publish even though 2 participants/))
    await userEvent.click(screen.getByLabelText('I confirm these are the final results'))
    await userEvent.click(screen.getByRole('button', { name: 'Publish results' }))

    expect(onSubmit).toHaveBeenCalledWith({ visibility: 'rank_only', confirm: true, accept_incomplete: true })
  })
})