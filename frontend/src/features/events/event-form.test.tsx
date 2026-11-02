import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import type React from 'react'
import { EventForm } from './event-form'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

async function fillBasics() {
  await userEvent.type(screen.getByLabelText('Event name'), 'Science Fair')
  await userEvent.type(screen.getByLabelText('Event code'), 'SF-1')
}

describe('EventForm', () => {
  it('requires name, a valid code and both dates', async () => {
    const onSubmit = vi.fn()
    render(<EventForm submitLabel="Create event" cancelHref="/events" onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: 'Create event' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Use 2 to 50 letters, numbers, dashes or underscores')).toBeInTheDocument()
    expect(screen.getAllByText('Choose a date and time')).toHaveLength(2)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects an end before the start', async () => {
    const onSubmit = vi.fn()
    render(<EventForm submitLabel="Create event" cancelHref="/events" onSubmit={onSubmit} />)

    await fillBasics()
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-12-01T10:00' } })
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-12-01T09:00' } })
    await userEvent.click(screen.getByRole('button', { name: 'Create event' }))

    expect(await screen.findByText('End must not be before the start')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits valid values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<EventForm submitLabel="Create event" cancelHref="/events" onSubmit={onSubmit} />)

    await fillBasics()
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-12-01T09:00' } })
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-12-01T17:00' } })
    await userEvent.click(screen.getByRole('button', { name: 'Create event' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ code: 'SF-1', starts_at: '2026-12-01T09:00' }))
  })
})