'use client'

import { useI18n } from '@/i18n/provider'

export function StatusBadge({ active }: { active: boolean }) {
  const { t } = useI18n()

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        active ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-slate-400'}`} aria-hidden="true" />
      {active ? t('common.active') : t('common.inactive')}
    </span>
  )
}