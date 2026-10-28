'use client'

import Link from 'next/link'
import { useI18n } from '@/i18n/provider'

export default function NotFound() {
  const { t } = useI18n()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl font-bold text-indigo-600">404</p>
      <h1 className="text-xl font-semibold">{t('notfound.title')}</h1>
      <p className="text-slate-600">{t('notfound.text')}</p>
      <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:underline">{t('forbidden.back')}</Link>
    </main>
  )
}