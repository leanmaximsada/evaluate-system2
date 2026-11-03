'use client'

import type { FormStatus } from '@/types'
import { useI18n } from '@/i18n/provider'

const tone: Record<FormStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  active: 'bg-green-50 text-green-700 ring-green-200',
  inactive: 'bg-amber-50 text-amber-700 ring-amber-200',
}

export function FormStatusBadge({ status }: { status: FormStatus }) {
  const { t } = useI18n()
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone[status]}`}>
      {t(`forms.status_${status}`)}
    </span>
  )
}