import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/features/auth/use-auth'
import { LandingPage } from './landing-page'

vi.mock('@/features/auth/use-auth', () => ({ useAuth: vi.fn() }))
vi.mock('@/theme/theme-toggle', () => ({ ThemeToggle: () => null }))
vi.mock('@/components/ui/language-switcher', () => ({ LanguageSwitcher: () => null }))

function signedInAs(user: { role: string } | null) {
  vi.mocked(useAuth).mockReturnValue({ user, isLoading: false } as never)
}

describe('LandingPage', () => {
  beforeEach(() => signedInAs(null))

  it('shows the headline and sends visitors to the sign-in page', () => {
    render(<LandingPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Run judged events with fair, transparent results' })).toBeInTheDocument()
    for (const link of screen.getAllByRole('link', { name: 'Sign in' })) {
      expect(link).toHaveAttribute('href', '/login')
    }
  })

  it('sends signed-in administrators to the dashboard and judges to the judge portal', () => {
    signedInAs({ role: 'admin' })
    const { unmount } = render(<LandingPage />)
    for (const link of screen.getAllByRole('link', { name: 'Open the app' })) {
      expect(link).toHaveAttribute('href', '/dashboard')
    }
    unmount()

    signedInAs({ role: 'judge' })
    render(<LandingPage />)
    for (const link of screen.getAllByRole('link', { name: 'Open the app' })) {
      expect(link).toHaveAttribute('href', '/judge')
    }
  })

  it('lists the features and the screenshot captions', () => {
    render(<LandingPage />)

    expect(screen.getByText('Flexible scoring forms')).toBeInTheDocument()
    expect(screen.getByText('Review before it goes public')).toBeInTheDocument()
    expect(screen.getAllByAltText('Public results screen').length).toBeGreaterThan(0)
  })
})