'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from '@phosphor-icons/react'
import { useParticipantResult } from '@/features/results/hooks'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage, getStatus } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'
import { ChartBar, Hash, UsersThree } from '@phosphor-icons/react'

const statusTone = {
  submitted: 'bg-green-50 text-green-700 ring-green-200',
  draft: 'bg-amber-50 text-amber-700 ring-amber-200',
  not_started: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export default function ParticipantResultPage() {
  const { t, formatDateTime } = useI18n()
  const params = useParams<{ id: string; participantId: string }>()
  const eventId = Number(params.id)
  const { data, isLoading, isError, error, refetch } = useParticipantResult(eventId, Number(params.participantId))

  if (isLoading) return <InlineSpinner />
  if (isError || !data) {
    return getStatus(error) === 404
      ? <ErrorState message={t('results.not_found')} />
      : <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
  }

  const { participant, result, judges } = data

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-3">
        <Link href={`/events/${eventId}/results`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('results.detail_back')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold text-slate-900">{participant.name}</h2>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">#{participant.number}</span>
          {participant.status !== 'registered' && <span className="text-sm text-slate-500">{t(`participants.status_${participant.status}`)}</span>}
        </div>
        {participant.team_name && <p className="text-sm text-slate-500">{participant.team_name}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('results.detail_aggregate')} value={result?.aggregate_score ?? '—'} hint={result?.calculated_at ? t('results.calculated', { date: formatDateTime(result.calculated_at) }) : undefined} icon={ChartBar} />
        <StatCard label={t('results.detail_rank')} value={result?.rank ?? '—'} hint={result?.is_tied ? t('results.tied') : undefined} icon={Hash} />
        <StatCard label={t('results.col_evaluations')} value={`${result?.evaluations_submitted ?? 0} / ${result?.judges_assigned ?? judges.length}`} icon={UsersThree} />
      </div>

      <h3 className="text-lg font-semibold text-slate-900">{t('results.detail_judges')}</h3>

      {judges.map((j) => (
        <Card
          key={j.judge.id}
          title={j.judge.name}
          description={j.judge.email}
          action={
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusTone[j.status]}`}>
              {t(`results.judge_${j.status}`)}
            </span>
          }
        >
          {j.status === 'submitted' ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t('results.col_criterion')}</th>
                      <th className="px-3 py-2 font-medium">{t('results.col_range')}</th>
                      <th className="px-3 py-2 font-medium">{t('results.col_weight')}</th>
                      <th className="px-3 py-2 font-medium">{t('results.col_judge_score')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {j.scores.map((s) => (
                      <tr key={s.criterion_id}>
                        <td className="px-3 py-2">{s.name}</td>
                        <td className="px-3 py-2 text-slate-600">{s.min_score} – {s.max_score}</td>
                        <td className="px-3 py-2 text-slate-600">{s.weight > 0 ? `${s.weight}%` : '—'}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{s.score ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-slate-700">
                <span className="font-medium">{t('results.judge_total')}: {j.total_score}</span>
                {j.submitted_at && <span className="text-slate-500"> · {t('results.submitted_at', { date: formatDateTime(j.submitted_at) })}</span>}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{t('results.no_scores')}</p>
          )}

          {j.revisions.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-900">{t('results.corrections')}</p>
              <ul className="space-y-2 text-sm">
                {j.revisions.map((r) => (
                  <li key={r.revision} className="rounded-lg bg-slate-50 p-3">
                    <p className="font-medium text-slate-900">{t('results.correction_head', { n: r.revision, name: r.changed_by ?? '—' })} · {formatDateTime(r.created_at)}</p>
                    {r.reason && <p className="text-slate-600">{t('results.reason_label', { text: r.reason })}</p>}
                    {r.previous_total && <p className="text-slate-500">{t('results.correction_prev', { total: r.previous_total })}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}