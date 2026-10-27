import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import LoginPage from './page'

const login = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => ({ user: null, isLoading: false, login }),
}))

describe('LoginPage', () => {
  beforeEach(() => login.mockReset())

  it('shows validation errors and does not call the API when fields are empty', async () => {
    render(<LoginPage />)
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('submits valid credentials', async () => {
    login.mockResolvedValue({})
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.test')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(login).toHaveBeenCalledWith({ email: 'admin@example.test', password: 'secret' })
  })
})