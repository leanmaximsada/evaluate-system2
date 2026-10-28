'use client'

import Link from 'next/link'
import { useI18n } from '@/i18n/provider'

export default function ForbiddenPage() {
  const { t } = useI18n()

  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <p className="text-5xl font-bold text-red-600">403</p>
      <h1 className="text-xl font-semibold">{t('forbidden.title')}</h1>
      <p className="text-slate-600">{t('forbidden.text')}</p>
      <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:underline">{t('forbidden.back')}</Link>
    </div>
  )
}