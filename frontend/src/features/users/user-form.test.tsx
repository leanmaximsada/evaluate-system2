import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import type React from 'react'
import type { User } from '@/types'
import { UserForm } from './user-form'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

const existing: User = {
  id: 7, name: 'Jane Doe', email: 'jane@example.test', role: 'admin', is_active: true,
  permissions: [], last_login_at: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

describe('UserForm', () => {
  it('create mode requires name, email and a strong password', async () => {
    const onSubmit = vi.fn()
    render(<UserForm submitLabel="Create user" cancelHref="/users" onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: 'Create user' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Use at least 10 characters')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('create mode rejects mismatched passwords', async () => {
    const onSubmit = vi.fn()
    render(<UserForm submitLabel="Create user" cancelHref="/users" onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText('Full name'), 'Jane Doe')
    await userEvent.type(screen.getByLabelText('Email'), 'jane@example.test')
    await userEvent.type(screen.getByLabelText('Password'), 'Str0ngPassword1')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Different1Password')
    await userEvent.click(screen.getByRole('button', { name: 'Create user' }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('edit mode needs no password and submits the current values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<UserForm initial={existing} submitLabel="Save changes" cancelHref="/users/7" onSubmit={onSubmit} />)

    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Jane Doe', email: 'jane@example.test', role: 'admin' }),
    )
  })
})