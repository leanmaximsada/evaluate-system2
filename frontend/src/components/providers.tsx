'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/use-auth'
import { I18nProvider } from '@/i18n/provider'
import type { Locale } from '@/i18n/core'

export function Providers({ children, initialLocale }: { children: ReactNode; initialLocale: Locale }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  )

  return (
    <I18nProvider initialLocale={initialLocale}>
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </I18nProvider>
  )
}