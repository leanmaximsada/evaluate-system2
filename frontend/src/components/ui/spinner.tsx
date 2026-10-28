'use client'

import { CircleNotch } from '@phosphor-icons/react'
import { useI18n } from '@/i18n/provider'

export function FullPageSpinner() {
  const { t } = useI18n()

  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label={t('common.loading')}>
      <CircleNotch className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  )
}

export function InlineSpinner() {
  const { t } = useI18n()

  return (
    <div className="flex justify-center py-12" role="status" aria-label={t('common.loading')}>
      <CircleNotch className="h-6 w-6 animate-spin text-indigo-600" />
    </div>
  )
}