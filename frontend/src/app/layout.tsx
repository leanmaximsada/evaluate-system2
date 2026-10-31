import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter, Noto_Sans_Khmer } from 'next/font/google'
import { Providers } from '@/components/providers'
import { LOCALE_COOKIE, isLocale } from '@/i18n/core'
import './globals.css'
import { getInitialLocale } from '@/i18n/server'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const khmer = Noto_Sans_Khmer({ subsets: ['khmer'], variable: '--font-khmer', display: 'swap' })

export const metadata: Metadata = {
  title: 'Evaluation System',
  description: 'Manage events, judges, scoring and live results.',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getInitialLocale()

  return (
    <html lang={locale} className={`${inter.variable} ${khmer.variable}`}>
      <body>
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  )
}