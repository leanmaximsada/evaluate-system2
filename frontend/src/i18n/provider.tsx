'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { MessageKey } from './messages/en'
import { LOCALE_COOKIE, isMessageKey, translate, type Locale } from './core'

interface I18nValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, params?: Record<string, string | number>) => string
  /** Translates the text if it is a message key (e.g. a Zod error), otherwise returns it unchanged. */
  tx: (text: string) => string
  formatDate: (value: string | Date) => string
  formatDateTime: (value: string | Date | null | undefined) => string
}

function build(locale: Locale, setLocale: (l: Locale) => void): I18nValue {
  const tag = locale === 'km' ? 'km-KH' : 'en-US'
  const t: I18nValue['t'] = (key, params) => translate(locale, key, params)

  return {
    locale,
    setLocale,
    t,
    tx: (text) => (isMessageKey(text) ? t(text) : text),
    formatDate: (value) => new Date(value).toLocaleDateString(tag),
    formatDateTime: (value) => (value ? new Date(value).toLocaleString(tag) : translate(locale, 'common.not_available')),
  }
}

// Without a provider (e.g. in isolated tests) components fall back to English.
const I18nContext = createContext<I18nValue>(build('en', () => {}))

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const setLocale = useCallback((next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = next
    setLocaleState(next)
  }, [])

  const value = useMemo(() => build(locale, setLocale), [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}