import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter, Kantumruy_Pro } from 'next/font/google'
import { Providers } from '@/components/providers'
import { LOCALE_COOKIE, isLocale } from '@/i18n/core'
import './globals.css'
import { getInitialLocale } from '@/i18n/server'
import { themeInitScript } from '@/theme/theme-provider'
import { ThemeProvider } from '@/theme/theme-provider'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

const khmer = Kantumruy_Pro({
  subsets: ['khmer', 'latin'],
  variable: '--font-khmer',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Evaluation System',
  description: 'Manage events, judges, scoring and live results.',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getInitialLocale()

  return (
    <ThemeProvider>
   <html lang="en" suppressHydrationWarning className={`${inter.variable} ${khmer.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
    </ThemeProvider>
  )
}