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
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
            <Trophy weight="fill" className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('app.name')}</h1>
        </div>
        {children}
      </div>
    </main>
  )
}