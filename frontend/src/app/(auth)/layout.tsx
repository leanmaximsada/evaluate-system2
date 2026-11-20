'use client'

import type { ReactNode } from 'react'
import { Trophy } from '@phosphor-icons/react'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { useI18n } from '@/i18n/provider'

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n()

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-end"><LanguageSwitcher /></div>
        <div className="flex flex-col items-center gap-3">
          <img src="/logo/logoblue.png" alt="Logo" className="h-12 w-12" />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('app.name')}</h1>
        </div>
        {children}
      </div>
    </main>
  )
}