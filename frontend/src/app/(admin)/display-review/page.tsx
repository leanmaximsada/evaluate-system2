'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useEvents } from '@/features/events/hooks'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage } from '@/lib/api'
import type { EventStatus } from '@/types'
import { Card } from '@/components/ui/card'
import { EventStatusBadge } from '@/components/ui/event-status-badge'
import { Pagination } from '@/components/ui/pagination'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

const selectClass = 'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10'
const STATUSES: EventStatus[] = ['completed', 'in_progress', 'upcoming', 'draft', 'cancelled']

export default function DisplayReviewListPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<EventStatus | ''>('completed')
  const [page, setPage] = useState(1)
  const { data, isLoading, isError, error, refetch, isFetching } = useEvents({ status, page })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t('displayreview.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('displayreview.list_hint')}</p>
      </div>

      <Card>
        <div className="mb-4">
          <select aria-label={t('events.filter_status')} className={selectClass} value={status} onChange={(e) => { setStatus(e.target.value as EventStatus | ''); setPage(1) }}>
            <option value="">{t('events.all_statuses')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`event.status_${s}`)}</option>)}
          </select>
        </div>

        {isLoading ? (
          <InlineSpinner />
        ) : isError || !data ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : data.data.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{t('events.no_match')}</p>
        ) : (
          <div className="space-y-4">
            <ul className="divide-y divide-slate-100">
              {data.data.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{e.name}</p>
                    <p className="text-sm text-slate-500">{e.code}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <EventStatusBadge status={e.status} />
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${e.is_published ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                      {t(e.is_published ? 'displayreview.published' : 'displayreview.not_published')}
                    </span>
                    <Link href={`/events/${e.id}/display`} className="text-sm font-medium text-slate-900 hover:underline">{t('displayreview.review')}</Link>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination meta={data.meta} onPage={setPage} disabled={isFetching} />
          </div>
        )}
      </Card>
    </div>
  )
}