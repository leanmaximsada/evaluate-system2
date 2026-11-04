'use client'

import { useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SignOut, Trophy } from '@phosphor-icons/react'
import { useAuth } from '@/features/auth/use-auth'
import { useI18n } from '@/i18n/provider'
import { FullPageSpinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/ui/language-switcher'

export function JudgeShell({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const { t } = useI18n()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) router.replace('/login')
    else if (user.role !== 'judge') router.replace('/dashboard')
  }, [isLoading, user, router])

  if (isLoading || !user || user.role !== 'judge') return <FullPageSpinner />

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/judge" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Trophy weight="fill" className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-semibold tracking-tight text-slate-900">{t('judge.portal')}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="secondary" onClick={handleLogout}>
              <SignOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('shell.sign_out')}</span>
            </Button>
          </div>
        </div>
        <p className="mx-auto max-w-3xl px-4 pb-2 text-xs text-slate-500">{user.name} · {t('judge.private_note')}</p>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 p-4 sm:py-8">{children}</main>
    </div>
  )
}