'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowsClockwise, DownloadSimple, EyeSlash, Megaphone } from '@phosphor-icons/react'
import { useAuth } from '@/features/auth/use-auth'
import { downloadResultsCsv, publishResults, recalculateResults, unpublishResults, type PublishPayload } from '@/features/results/api'
import { resultKeys, usePublications, useResults } from '@/features/results/hooks'
import { PublishDialog } from '@/features/results/publish-dialog'
import { UnpublishDialog } from '@/features/results/unpublish-dialog'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage, getErrorMessages } from '@/lib/api'
import type { EvaluationState } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { StatCard } from '@/components/ui/stat-card'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'
import { CheckCircle, Gavel, UsersThree } from '@phosphor-icons/react'
import { LiveIndicator } from '@/features/live/live-indicator'
import { useRealtimeSignal, type ConnectionState } from '@/features/live/use-realtime'

const stateTone: Record<EvaluationState, string> = {
  complete: 'bg-green-50 text-green-700 ring-green-200',
  partial: 'bg-amber-50 text-amber-700 ring-amber-200',
  none: 'bg-slate-100 text-slate-600 ring-slate-200',
}
const participantTone = {
  registered: '',
  withdrawn: 'bg-slate-100 text-slate-600 ring-slate-200',
  disqualified: 'bg-red-50 text-red-700 ring-red-200',
}

type Feedback = { kind: 'success' | 'error'; text: string }

export default function EventResultsPage() {
  const { t, formatDateTime } = useI18n()
  const { can } = useAuth()
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const queryClient = useQueryClient()
  const [conn, setConn] = useState<ConnectionState>('connecting')

  const { data, isLoading, isError, error, refetch } = useResults(id, conn === 'connected' ? false : 30_000)
  const history = usePublications(id)
  useRealtimeSignal(`events.${id}.results`, 'results.updated', true, () => {
    queryClient.invalidateQueries({ queryKey: resultKeys.all })
  }, setConn)

  const [dialog, setDialog] = useState<'publish' | 'unpublish' | null>(null)
  const [dialogErrors, setDialogErrors] = useState<string[] | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [exporting, setExporting] = useState(false)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: resultKeys.all })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const closeDialog = () => { setDialog(null); setDialogErrors(null) }

  const recalc = useMutation({
    mutationFn: () => recalculateResults(id),
    onSuccess: () => { refresh(); setFeedback({ kind: 'success', text: t('results.recalculated') }) },
    onError: (e) => setFeedback({ kind: 'error', text: getErrorMessage(e) }),
  })
  const publish = useMutation({
    mutationFn: (payload: PublishPayload) => publishResults(id, payload),
    onSuccess: () => { closeDialog(); refresh(); setFeedback({ kind: 'success', text: t('results.published_ok') }) },
    onError: (e) => setDialogErrors(getErrorMessages(e)),
  })
  const unpublish = useMutation({
    mutationFn: (reason: string) => unpublishResults(id, reason),
    onSuccess: () => { closeDialog(); refresh(); setFeedback({ kind: 'success', text: t('results.unpublished_ok') }) },
    onError: (e) => setDialogErrors(getErrorMessages(e)),
  })

  async function exportCsv() {
    if (!data) return
    setExporting(true)
    try {
      await downloadResultsCsv(id, data.event.code)
    } catch {
      setFeedback({ kind: 'error', text: t('results.export_failed') })
    } finally {
      setExporting(false)
    }
  }

  if (isLoading) return <InlineSpinner />
  if (isError || !data) return <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />

  const { summary, publication: pub, rows } = data
  const isPublished = pub.status === 'published'
  const incomplete = rows.filter((r) => r.participant_status === 'registered' && !r.is_complete).length
  const canPublishNow = can('results.publish') && data.event.status === 'completed' && !isPublished

  const pubLabel =
    pub.status === 'published' ? t('results.pub_published', { n: pub.revision ?? 1 })
    : pub.status === 'unpublished' ? t('results.pub_unpublished')
    : t('results.pub_none')

  return (
    <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
        <LiveIndicator state={conn} />
        {isPublished && (
          <Link href={`/live/${data.event.code}`} target="_blank" className="text-sm font-medium text-slate-900 underline">
            {t('results.open_public')}
          </Link>
        )}
      </div>
      {feedback && <Alert kind={feedback.kind}>{feedback.text}</Alert>}
      {data.is_provisional && <Alert kind="info">{t('results.provisional')}</Alert>}
      {pub.needs_republish && <Alert kind="error">{t('results.needs_republish')}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('results.stat_participants')} value={summary.participants} icon={UsersThree} />
        <StatCard label={t('results.stat_judges')} value={summary.judges_assigned} icon={Gavel} />
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-600">{t('results.stat_completion')}</p>
            <CheckCircle className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{summary.completion_percent}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={summary.completion_percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(100, summary.completion_percent)}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-500">{t('results.completion_hint', { done: summary.evaluations_submitted, total: summary.evaluations_expected })}</p>
        </div>
        <StatCard label={t('results.stat_publication')} value={<span className="text-xl">{pubLabel}</span>} hint={pub.published_at ? formatDateTime(pub.published_at) : undefined} icon={Megaphone} />
      </div>

      <Card
        title={t('results.ranking')}
        action={
          <div className="flex flex-wrap gap-2">
            {can('results.publish') && (
              <Button variant="secondary" onClick={() => recalc.mutate()} loading={recalc.isPending}>
                <ArrowsClockwise className="h-4 w-4" aria-hidden="true" />{t('results.recalculate')}
              </Button>
            )}
            {can('results.export') && (
              <Button variant="secondary" onClick={exportCsv} loading={exporting}>
                <DownloadSimple className="h-4 w-4" aria-hidden="true" />{t('results.export')}
              </Button>
            )}
            {canPublishNow && (
              <Button onClick={() => setDialog('publish')}><Megaphone className="h-4 w-4" aria-hidden="true" />{t('results.publish')}</Button>
            )}
            {can('results.unpublish') && isPublished && (
              <Button variant="danger" onClick={() => setDialog('unpublish')}><EyeSlash className="h-4 w-4" aria-hidden="true" />{t('results.unpublish')}</Button>
            )}
          </div>
        }
      >
        {can('results.publish') && data.event.status !== 'completed' && !isPublished && (
          <p className="mb-4 text-sm text-slate-500">{t('results.publish_after_complete')}</p>
        )}

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t('results.no_participants')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {(['results.col_rank', 'results.col_number', 'results.col_participant', 'results.col_score', 'results.col_evaluations', 'results.col_state'] as const).map((k) => (
                    <th key={k} scope="col" className="px-3 py-2 font-medium">{t(k)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.participant_id} className={`hover:bg-slate-50 ${r.rank === null ? 'text-slate-500' : ''}`}>
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      {r.rank ?? '—'}
                      {r.is_tied && <span title={t('results.tied')} className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">{t('results.tied')}</span>}
                    </td>
                    <td className="px-3 py-3">{r.number}</td>
                    <td className="px-3 py-3">
                      <Link href={`/events/${id}/results/${r.participant_id}`} className="font-medium text-slate-900 hover:underline">{r.name}</Link>
                      {r.team_name && <p className="text-xs text-slate-500">{r.team_name}</p>}
                      {r.participant_status !== 'registered' && (
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${participantTone[r.participant_status]}`}>
                          {t(`participants.status_${r.participant_status}`)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-900">{r.aggregate_score ?? '—'}</td>
                    <td className="px-3 py-3">{r.evaluations_submitted} / {r.judges_assigned}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${stateTone[r.evaluation_status]}`}>
                        {t(`results.eval_${r.evaluation_status}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t('results.history')}>
        {history.isLoading ? (
          <InlineSpinner />
        ) : !history.data || history.data.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">{t('results.history_none')}</p>
        ) : (
          <ul className="space-y-3">
            {history.data.map((p) => (
              <li key={p.revision} className="rounded-lg border border-slate-200">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span className="font-medium text-slate-900">
                      {t('results.revision', { n: p.revision })} · {t(p.status === 'published' ? 'results.status_published' : 'results.status_unpublished')}
                    </span>
                    <span className="text-slate-500">
                      {p.published_by ? t('results.published_by', { name: p.published_by }) : ''}{p.published_at ? ` · ${formatDateTime(p.published_at)}` : ''}
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm">
                    {p.visibility && <p className="text-slate-600">{t('results.visibility')}: {t(p.visibility === 'rank_only' ? 'results.vis_rank_only' : 'results.vis_rank_and_score')}</p>}
                    {p.correction_reason && <p className="text-slate-600">{t('results.reason_label', { text: p.correction_reason })}</p>}
                    <p className="text-slate-500">{t('results.snapshot_rows', { n: p.rows_count })}</p>
                    {p.rows && p.rows.length > 0 && (
                      <table className="w-full text-left">
                        <thead className="text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="py-1 pr-3 font-medium">{t('results.col_rank')}</th>
                            <th className="py-1 pr-3 font-medium">{t('results.col_number')}</th>
                            <th className="py-1 pr-3 font-medium">{t('results.col_participant')}</th>
                            {p.visibility !== 'rank_only' && <th className="py-1 font-medium">{t('results.col_score')}</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {p.rows.map((row) => (
                            <tr key={`${row.number}-${row.rank}`}>
                              <td className="py-1 pr-3">{row.rank}{row.tied ? ' *' : ''}</td>
                              <td className="py-1 pr-3">{row.number}</td>
                              <td className="py-1 pr-3">{row.name}</td>
                              {p.visibility !== 'rank_only' && <td className="py-1">{row.score ?? '—'}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {dialog === 'publish' && (
        <PublishDialog
          open
          hasPrevious={pub.revision !== null}
          incompleteCount={incomplete}
          loading={publish.isPending}
          errors={dialogErrors}
          onSubmit={(payload) => publish.mutate(payload)}
          onClose={closeDialog}
        />
      )}
      {dialog === 'unpublish' && (
        <UnpublishDialog open loading={unpublish.isPending} errors={dialogErrors} onSubmit={(reason) => unpublish.mutate(reason)} onClose={closeDialog} />
      )}
    </div>
  )
}