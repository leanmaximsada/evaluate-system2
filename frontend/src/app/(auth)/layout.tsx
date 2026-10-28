'use client'

import type { ReactNode } from 'react'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { useI18n } from '@/i18n/provider'

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n()

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-end"><LanguageSwitcher /></div>
        <h1 className="text-center text-2xl font-bold text-indigo-700">{t('app.name')}</h1>
        {children}
      </div>
    </main>
  )
}