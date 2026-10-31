'use client'

import type { Paginated } from '@/types'
import { useI18n } from '@/i18n/provider'
import { Button } from './button'

export function Pagination({
  meta,
  onPage,
  disabled = false,
}: {
  meta: Paginated<unknown>['meta']
  onPage: (page: number) => void
  disabled?: boolean
}) {
  const { t } = useI18n()
  if (meta.total === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <p>{t('pagination.showing', { from: meta.from ?? 0, to: meta.to ?? 0, total: meta.total })}</p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={disabled || meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}>
          {t('common.previous')}
        </Button>
        <span>{t('pagination.page', { page: meta.current_page, last: meta.last_page })}</span>
        <Button variant="secondary" disabled={disabled || meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)}>
          {t('common.next')}
        </Button>
      </div>
    </div>
  )
}