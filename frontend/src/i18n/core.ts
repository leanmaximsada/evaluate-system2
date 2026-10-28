import { en, type MessageKey } from './messages/en'
import { km } from './messages/km'

export type Locale = 'en' | 'km'
export const LOCALE_COOKIE = 'eval_locale'

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, km }

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'km'
}

export function translate(locale: Locale, key: MessageKey, params?: Record<string, string | number>): string {
  let text = dictionaries[locale][key] ?? dictionaries.en[key] ?? key
  if (params) {
    for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value))
  }
  return text
}

export function isMessageKey(text: string): text is MessageKey {
  return text in en
}

export function readLocaleCookie(): Locale {
  if (typeof document === 'undefined') return 'en'
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))
  const value = match?.[1]
  return isLocale(value) ? value : 'en'
}