import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { Inter, Kantumruy_Pro } from 'next/font/google'
import { Providers } from '@/components/providers'
import { LOCALE_COOKIE, isLocale } from '@/i18n/core'
import { themeInitScript } from '@/theme/theme-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const khmer = Kantumruy_Pro({ subsets: ['khmer', 'latin'], variable: '--font-khmer', display: 'swap' })

export const metadata: Metadata = {
  title: 'Evaluation System',
  description: 'Manage events, judges, scoring and live results.',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = isLocale(stored) ? stored : 'en'

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${khmer.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  )
}