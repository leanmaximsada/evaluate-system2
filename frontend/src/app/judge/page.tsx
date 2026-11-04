'use client'

import Link from 'next/link'
import { useJudgeEvents } from '@/features/judge/hooks'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage } from '@/lib/api'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

export default function JudgeHomePage() {
  const { t } = useI18n()
  const { data, isLoading, isError, error, refetch } = useJudgeEvents()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t('judge.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('judge.subtitle')}</p>
      </div>

      {isLoading ? (
        <InlineSpinner />
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{t('judge.no_events')}</p>
      ) : (
        <ul className="space-y-4">
          {data.map((e) => {
            const percent = e.participants_total > 0 ? Math.round((e.submitted / e.participants_total) * 100) : 0
            return (
              <li key={e.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{e.name}</p>
                    <p className="text-sm text-slate-500">{e.code}{e.venue ? ` · ${e.venue}` : ''}</p>
                  </div>
                  <Link href={`/judge/events/${e.id}`} className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800">
                    {t('judge.open')}
                  </Link>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {t('judge.progress', { done: e.submitted, total: e.participants_total })}
                  {e.drafts > 0 && ` · ${t('judge.drafts', { n: e.drafts })}`}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}