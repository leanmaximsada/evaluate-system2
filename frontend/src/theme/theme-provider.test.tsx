import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { THEME_KEY, ThemeProvider, useTheme } from './theme-provider'

function Probe() {
  const { theme, toggle } = useTheme()
  return <button onClick={toggle}>{theme ?? 'unknown'}</button>
}

function setup() {
  render(<ThemeProvider><Probe /></ThemeProvider>)
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('starts light', async () => {
    setup()
    expect(await screen.findByRole('button', { name: 'light' })).toBeInTheDocument()
  })

  it('toggles, updates the page and remembers the choice', async () => {
    setup()

    await userEvent.click(await screen.findByRole('button', { name: 'light' }))
    expect(await screen.findByRole('button', { name: 'dark' })).toBeInTheDocument()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')

    await userEvent.click(screen.getByRole('button', { name: 'dark' }))
    expect(await screen.findByRole('button', { name: 'light' })).toBeInTheDocument()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
  })

  it('picks up the theme the startup script already applied', async () => {
    document.documentElement.classList.add('dark')
    setup()

    expect(await screen.findByRole('button', { name: 'dark' })).toBeInTheDocument()
  })
})