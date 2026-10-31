import { cookies } from 'next/headers'
import { LOCALE_COOKIE, isLocale, type Locale } from './core'

/** The visitor's saved choice wins; otherwise the admin's "Default language" setting; otherwise English. */
export async function getInitialLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value
  if (isLocale(stored)) return stored

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/settings`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const body = await res.json()
      if (isLocale(body?.data?.default_language)) return body.data.default_language
    }
  } catch {
    // API unreachable or slow: fall through to English.
  }
  return 'en'
}