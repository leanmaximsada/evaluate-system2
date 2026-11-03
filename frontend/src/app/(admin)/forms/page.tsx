'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { useDebounce } from '@/hooks/use-debounce'
import { useForms } from '@/features/forms/hooks'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage } from '@/lib/api'
import type { FormStatus } from '@/types'
import { Card } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'
import { FormStatusBadge } from '@/components/ui/form-status-badge'
import { Pagination } from '@/components/ui/pagination'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

const selectClass = 'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10'
const STATUSES: FormStatus[] = ['draft', 'active', 'inactive']

export default function FormsPage() {
  const { t, formatDate } = useI18n()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<FormStatus | ''>('')
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search.trim(), 300)

  const filters = useMemo(() => ({ search: debounced, status, page }), [debounced, status, page])
  const { data, isLoading, isError, error, refetch, isFetching } = useForms(filters)
  const hasFilters = !!(debounced || status)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{t('forms.title')}</h1>
        <LinkButton href="/forms/new"><Plus className="h-4 w-4" aria-hidden="true" />{t('forms.new')}</LinkButton>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-56 flex-1">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              aria-label={t('forms.search')}
              placeholder={t('forms.search')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <select aria-label={t('forms.filter_status')} className={selectClass} value={status} onChange={(e) => { setStatus(e.target.value as FormStatus | ''); setPage(1) }}>
            <option value="">{t('forms.all_statuses')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`forms.status_${s}`)}</option>)}
          </select>
        </div>

        {isLoading ? (
          <InlineSpinner />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : data && data.data.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{hasFilters ? t('forms.no_match') : t('forms.none')}</p>
        ) : (
          data && (
            <div className="space-y-4">
              <div className={`overflow-x-auto ${isFetching ? 'opacity-70' : ''}`}>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {(['forms.col_form', 'forms.col_status', 'forms.col_latest', 'forms.col_versions', 'forms.col_updated'] as const).map((k) => (
                        <th key={k} scope="col" className="px-3 py-2 font-medium">{t(k)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.data.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <Link href={`/forms/${f.id}`} className="font-medium text-slate-900 hover:underline">{f.name}</Link>
                          {f.has_draft && <p className="text-xs text-amber-700">{t('forms.draft_pending')}</p>}
                        </td>
                        <td className="px-3 py-3"><FormStatusBadge status={f.status} /></td>
                        <td className="px-3 py-3 text-slate-600">{f.latest_published_version ? t('forms.version_label', { n: f.latest_published_version }) : '—'}</td>
                        <td className="px-3 py-3 text-slate-600">{f.versions_count}</td>
                        <td className="px-3 py-3 text-slate-600">{formatDate(f.updated_at)}</td>
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