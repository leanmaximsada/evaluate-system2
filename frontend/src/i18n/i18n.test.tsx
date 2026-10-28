import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { en } from './messages/en'
import { km } from './messages/km'
import { I18nProvider, useI18n } from './provider'

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')

function Probe() {
  const { t, setLocale } = useI18n()
  return (
    <>
      <p>{t('auth.sign_in')}</p>
      <button onClick={() => setLocale('km')}>switch</button>
    </>
  )
}

describe('i18n', () => {
  it('has a Khmer translation with matching placeholders for every key', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(km[key], key).toBeTruthy()
      expect(placeholders(km[key]), key).toBe(placeholders(en[key]))
    }
  })

  it('switches language, updates <html lang> and stores the choice', async () => {
    render(<I18nProvider initialLocale="en"><Probe /></I18nProvider>)
    expect(screen.getByText('Sign in')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'switch' }))

    expect(screen.getByText('ចូលប្រព័ន្ធ')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('km')
    expect(document.cookie).toContain('eval_locale=km')
  })
})