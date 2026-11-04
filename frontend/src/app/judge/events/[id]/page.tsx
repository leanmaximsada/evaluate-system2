'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from '@phosphor-icons/react'
import { useJudgeEvent } from '@/features/judge/hooks'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage, getStatus } from '@/lib/api'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

const tone = {
  not_started: 'bg-slate-100 text-slate-600 ring-slate-200',
  draft: 'bg-amber-50 text-amber-700 ring-amber-200',
  submitted: 'bg-green-50 text-green-700 ring-green-200',
}

export default function JudgeEventPage() {
  const { t } = useI18n()
  const id = Number(useParams<{ id: string }>().id)
  const { data, isLoading, isError, error, refetch } = useJudgeEvent(id)

  if (isLoading) return <InlineSpinner />
  if (isError || !data) {
    return getStatus(error) === 404
      ? <ErrorState message={t('judge.not_found')} />
      : <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
  }

  const done = data.participants.filter((p) => p.evaluation_status === 'submitted').length

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/judge" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('judge.back_events')}
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">{data.event.name}</h1>
        {data.event.description && <p className="text-sm text-slate-600">{data.event.description}</p>}
        <p className="text-sm font-medium text-slate-700">{t('judge.progress', { done, total: data.participants.length })}</p>
      </div>

      {data.participants.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{t('judge.no_participants')}</p>
      ) : (
        <ul className="space-y-3">
          {data.participants.map((p) => (
            <li key={p.id}>
              <Link
                href={`/judge/events/${id}/participants/${p.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-400"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">#{p.number} · {p.name}</p>
                  {p.team_name && <p className="truncate text-sm text-slate-500">{p.team_name}</p>}
                  {p.total_score && <p className="text-sm text-slate-600">{t('judge.your_total', { total: p.total_score })}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone[p.evaluation_status]}`}>
                    {t(`judge.status_${p.evaluation_status}`)}
                  </span>
                  <span className="text-sm font-medium text-slate-900">
                    {p.evaluation_status === 'submitted' ? t('judge.view') : p.evaluation_status === 'draft' ? t('judge.continue') : t('judge.score_action')}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}