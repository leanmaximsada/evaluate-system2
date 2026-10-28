import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { Noto_Sans_Khmer } from 'next/font/google'
import { Providers } from '@/components/providers'
import { LOCALE_COOKIE, isLocale } from '@/i18n/core'
import './globals.css'

const khmer = Noto_Sans_Khmer({ subsets: ['khmer'], variable: '--font-khmer', display: 'swap' })

export const metadata: Metadata = {
  title: 'Evaluation System',
  description: 'Manage events, judges, scoring and live results.',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = isLocale(stored) ? stored : 'en'

  return (
    <html lang={locale} className={khmer.variable}>
      <body>
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  )
}