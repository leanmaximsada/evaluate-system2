'use client'

import type { EventStatus } from '@/types'
import { useI18n } from '@/i18n/provider'

const tone: Record<EventStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  upcoming: 'bg-blue-50 text-blue-700 ring-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 ring-amber-200',
  completed: 'bg-green-50 text-green-700 ring-green-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const { t } = useI18n()
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone[status]}`}>
      {t(`event.status_${status}`)}
    </span>
  )
}