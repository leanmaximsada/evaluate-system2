'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { useDebounce } from '@/hooks/use-debounce'
import { useEvents } from '@/features/events/hooks'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage } from '@/lib/api'
import type { EventStatus } from '@/types'
import { Card } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'
import { EventStatusBadge } from '@/components/ui/event-status-badge'
import { Pagination } from '@/components/ui/pagination'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

const selectClass = 'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10'
const STATUSES: EventStatus[] = ['draft', 'upcoming', 'in_progress', 'completed', 'cancelled']

export default function EventsPage() {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EventStatus | ''>('')
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search.trim(), 300)

  const filters = useMemo(() => ({ search: debounced, status, page }), [debounced, status, page])
  const { data, isLoading, isError, error, refetch, isFetching } = useEvents(filters)
  const hasFilters = !!(debounced || status)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{t('events.title')}</h1>
        <LinkButton href="/events/new"><Plus className="h-4 w-4" aria-hidden="true" />{t('events.new')}</LinkButton>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-56 flex-1">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              aria-label={t('events.search')}
              placeholder={t('events.search')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <select aria-label={t('events.filter_status')} className={selectClass} value={status} onChange={(e) => { setStatus(e.target.value as EventStatus | ''); setPage(1) }}>
            <option value="">{t('events.all_statuses')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`event.status_${s}`)}</option>)}
          </select>
        </div>

        {isLoading ? (
          <InlineSpinner />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : data && data.data.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{hasFilters ? t('events.no_match') : t('events.none')}</p>
        ) : (
          data && (
            <div className="space-y-4">
              <div className={`overflow-x-auto ${isFetching ? 'opacity-70' : ''}`}>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {(['events.col_event', 'events.col_status', 'events.col_starts', 'events.col_venue', 'events.col_participants', 'events.col_judges'] as const).map((k) => (
                        <th key={k} scope="col" className="px-3 py-2 font-medium">{t(k)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.data.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <Link href={`/events/${e.id}`} className="font-medium text-slate-900 hover:underline">{e.name}</Link>
                          <p className="text-xs text-slate-500">{e.code}</p>
                        </td>
                        <td className="px-3 py-3"><EventStatusBadge status={e.status} /></td>
                        <td className="px-3 py-3 text-slate-600">{e.starts_at_local.replace('T', ' ')}</td>
                        <td className="px-3 py-3 text-slate-600">{e.venue ?? '—'}</td>
                        <td className="px-3 py-3 text-slate-600">{e.participants_count ?? 0}</td>
                        <td className="px-3 py-3 text-slate-600">{e.judges_count ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={data.meta} onPage={setPage} disabled={isFetching} />
            </div>
          )
        )}
      </Card>
    </div>
  )
}