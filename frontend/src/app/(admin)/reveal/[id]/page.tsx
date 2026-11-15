'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowSquareOut } from '@phosphor-icons/react'
import { sendRevealAction } from '@/features/reveal/api'
import { revealKey, useRevealState } from '@/features/reveal/hooks'
import { useEvent } from '@/features/events/hooks'
import { useI18n } from '@/i18n/provider'
import { ordinal } from '@/i18n/ordinal'
import { getErrorMessage } from '@/lib/api'
import type { RevealAction } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

export default function RevealRemotePage() {
  const { t, locale } = useI18n()
  const eventId = Number(useParams<{ id: string }>().id)
  const queryClient = useQueryClient()
  const { data: event } = useEvent(eventId)
  const state = useRevealState(eventId)

  const [confirm, setConfirm] = useState<'all' | 'reset' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const act = useMutation({
    mutationFn: (action: RevealAction) => sendRevealAction(eventId, action),
    onSuccess: (next) => { queryClient.setQueryData(revealKey(eventId), next); setError(null) },
    onError: (e) => setError(getErrorMessage(e)),
    onSettled: () => setConfirm(null),
  })

  if (state.isLoading) return <InlineSpinner />
  if (state.isError || !state.data) return <ErrorState message={getErrorMessage(state.error)} onRetry={() => state.refetch()} />

  const data = state.data
  const upNext = data.steps.find((step) => !step.revealed)
  const busy = act.isPending

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <Link href={`/events/${eventId}/display`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('reveal.back')}
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">{t('reveal.title')}</h1>
        {event && <p className="text-sm text-slate-500">{event.name}</p>}
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      {!data.published ? (
        <Alert kind="info">{t('reveal.not_published')}</Alert>
      ) : !data.enabled ? (
        <Alert kind="info">{t('reveal.not_enabled')}</Alert>
      ) : (
        <>
          <Card>
            <p className="text-sm font-medium text-slate-700">{t('reveal.progress', { done: data.revealed_steps, total: data.total_steps })}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={data.revealed_steps} aria-valuemin={0} aria-valuemax={data.total_steps}>
              <div className="h-full rounded-full bg-slate-900" style={{ width: `${data.total_steps > 0 ? (data.revealed_steps / data.total_steps) * 100 : 0}%` }} />
            </div>

            {upNext ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('reveal.next_up')}: {ordinal(locale, upNext.rank)}</p>
                <ul className="mt-2 space-y-1">
                  {upNext.rows.map((row) => (
                    <li key={row.number} className="flex items-baseline justify-between gap-3 text-lg font-semibold text-slate-900">
                      <span className="truncate">{row.name}</span>
                      <span className="text-sm font-medium text-slate-500">#{row.number}{row.score ? ` · ${row.score}` : ''}</span>
                    </li>
                  ))}
                </ul>
                {upNext.rows.length > 1 && <p className="mt-2 text-xs text-slate-500">{t('reveal.tied_note')}</p>}
              </div>
            ) : (
              <p className="mt-4 text-sm font-medium text-green-700">{t('reveal.complete')}</p>
            )}
          </Card>

          <button
            type="button"
            disabled={busy || data.complete}
            onClick={() => act.mutate('next')}
            className="h-20 w-full rounded-2xl bg-slate-900 text-xl font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40"
          >
            {t('reveal.next')}
          </button>

          <div className="grid grid-cols-3 gap-3">
            <Button variant="secondary" disabled={busy || data.revealed_steps === 0} onClick={() => act.mutate('undo')}>{t('reveal.undo')}</Button>
            <Button variant="secondary" disabled={busy || data.complete} onClick={() => setConfirm('all')}>{t('reveal.all')}</Button>
            <Button variant="secondary" disabled={busy || data.revealed_steps === 0} onClick={() => setConfirm('reset')}>{t('reveal.reset')}</Button>
          </div>

          <Card title={t('reveal.steps')}>
            <ol className="space-y-2">
              {data.steps.map((step) => (
                <li key={step.rank} className="flex items-start justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-900">{ordinal(locale, step.rank)} · {step.rows.map((row) => row.name).join(', ')}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${step.revealed ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                    {t(step.revealed ? 'reveal.step_revealed' : 'reveal.step_hidden')}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}

      {event && (
        <Link href={`/live/${event.code}`} target="_blank" className="inline-flex items-center gap-2 text-sm font-medium text-slate-900 underline">
          <ArrowSquareOut className="h-4 w-4" aria-hidden="true" />{t('reveal.open_public')}
        </Link>
      )}

      <ConfirmDialog
        open={confirm === 'all'}
        title={t('reveal.all_title')}
        message={t('reveal.all_text')}
        confirmLabel={t('reveal.all')}
        loading={busy}
        onConfirm={() => act.mutate('all')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'reset'}
        title={t('reveal.reset_title')}
        message={t('reveal.reset_text')}
        confirmLabel={t('reveal.reset')}
        danger
        loading={busy}
        onConfirm={() => act.mutate('reset')}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}