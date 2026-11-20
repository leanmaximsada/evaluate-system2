import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Logo } from './logo'

describe('Logo', () => {
  it('shows the logo file and turns it white in dark mode', () => {
    render(<Logo />)

    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('src', '/logo/logoblack.png')
    expect(image.className).toContain('dark:invert')
    expect(image.className).toContain('dark:brightness-0')
  })

  it('falls back to an icon when the file cannot be loaded', () => {
    render(<Logo />)

    fireEvent.error(screen.getByRole('img'))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})