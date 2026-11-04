'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useEvents } from '@/features/events/hooks'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { EventStatusBadge } from '@/components/ui/event-status-badge'
import { Pagination } from '@/components/ui/pagination'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

export default function ResultsIndexPage() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const { data, isLoading, isError, error, refetch, isFetching } = useEvents({ page })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t('results.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('results.list_hint')}</p>
      </div>

      <Card>
        {isLoading ? (
          <InlineSpinner />
        ) : isError || !data ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : data.data.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{t('events.none')}</p>
        ) : (
          <div className="space-y-4">
            <ul className="divide-y divide-slate-100">
              {data.data.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{e.name}</p>
                    <p className="text-sm text-slate-500">{e.code} · {t('results.stat_participants')}: {e.participants_count ?? 0}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <EventStatusBadge status={e.status} />
                    <Link href={`/events/${e.id}/results`} className="text-sm font-medium text-slate-900 hover:underline">{t('results.open')}</Link>
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