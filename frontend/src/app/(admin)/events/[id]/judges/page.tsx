'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MagnifyingGlass, UserMinus } from '@phosphor-icons/react'
import { assignJudge, unassignJudge } from '@/features/events/api'
import { eventKeys, useEvent, useEventJudges, useJudgeCandidates } from '@/features/events/hooks'
import { useDebounce } from '@/hooks/use-debounce'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage } from '@/lib/api'
import type { Judge } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

export default function EventJudgesPage() {
  const { t } = useI18n()
  const params = useParams<{ id: string }>()
  const eventId = Number(params.id)
  const queryClient = useQueryClient()
  const { data: event } = useEvent(eventId)
  const assigned = useEventJudges(eventId)
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search.trim(), 300)
  const candidates = useJudgeCandidates(eventId, debounced, !!event && !event.is_closed)

  const [toRemove, setToRemove] = useState<Judge | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: eventKeys.all })
  const onError = (e: unknown) => setFeedback(getErrorMessage(e))

  const assign = useMutation({
    mutationFn: (judge: Judge) => assignJudge(eventId, judge.id),
    onSuccess: () => { setFeedback(null); refresh() },
    onError,
  })
  const remove = useMutation({
    mutationFn: (judge: Judge) => unassignJudge(eventId, judge.id),
    onSuccess: () => { setFeedback(null); refresh() },
    onError,
    onSettled: () => setToRemove(null),
  })

  if (!event) return null

  return (
    <div className="space-y-6">
      {feedback && <Alert kind="error">{feedback}</Alert>}
      {event.is_closed && <Alert kind="info">{t('judges.closed_note')}</Alert>}

      <Card title={t('judges.assigned')}>
        {assigned.isLoading ? (
          <InlineSpinner />
        ) : assigned.isError || !assigned.data ? (
          <ErrorState message={getErrorMessage(assigned.error)} onRetry={() => assigned.refetch()} />
        ) : assigned.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{t('judges.none_assigned')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {assigned.data.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{j.name}</p>
                  <p className="text-sm text-slate-500">{j.email}</p>
                </div>
                {!event.is_closed && (
                  <Button variant="secondary" onClick={() => setToRemove(j)}>
                    <UserMinus className="h-4 w-4" aria-hidden="true" />{t('common.remove')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!event.is_closed && (
        <Card title={t('judges.add')}>
          <div className="relative mb-4">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              aria-label={t('judges.search')}
              placeholder={t('judges.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          {candidates.isLoading ? (
            <InlineSpinner />
          ) : candidates.isError ? (
            <ErrorState message={getErrorMessage(candidates.error)} onRetry={() => candidates.refetch()} />
          ) : !candidates.data || candidates.data.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{t('judges.no_candidates')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {candidates.data.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{j.name}</p>
                    <p className="text-sm text-slate-500">{j.email}</p>
                  </div>
                  <Button onClick={() => assign.mutate(j)} loading={assign.isPending && assign.variables?.id === j.id}>{t('judges.assign')}</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={toRemove !== null}
        title={t('judges.remove_title')}
        message={toRemove ? t('judges.remove_text', { name: toRemove.name }) : ''}
        confirmLabel={t('common.remove')}
        danger
        loading={remove.isPending}
        onConfirm={() => toRemove && remove.mutate(toRemove)}
        onCancel={() => setToRemove(null)}
      />
    </div>
  )
}