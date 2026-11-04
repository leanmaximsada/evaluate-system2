'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from '@phosphor-icons/react'
import { saveJudgeDraft, submitJudgeScores } from '@/features/judge/api'
import { judgeKeys, useJudgeEvent, useJudgeParticipant } from '@/features/judge/hooks'
import { ScoreForm } from '@/features/judge/score-form'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage, getStatus } from '@/lib/api'
import type { JudgeParticipantItem } from '@/types'
import { Alert } from '@/components/ui/alert'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

function nextPending(list: JudgeParticipantItem[], currentId: number): JudgeParticipantItem | null {
  const index = list.findIndex((p) => p.id === currentId)
  const ordered = [...list.slice(index + 1), ...list.slice(0, Math.max(index, 0))]
  return ordered.find((p) => p.id !== currentId && p.evaluation_status !== 'submitted') ?? null
}

export default function JudgeScorePage() {
  const { t } = useI18n()
  const params = useParams<{ id: string; participantId: string }>()
  const eventId = Number(params.id)
  const participantId = Number(params.participantId)
  const queryClient = useQueryClient()

  const detail = useJudgeParticipant(eventId, participantId)
  const event = useJudgeEvent(eventId)
  const [justSubmitted, setJustSubmitted] = useState(false)

  const refresh = () => queryClient.invalidateQueries({ queryKey: judgeKeys.all })
  const draft = useMutation({ mutationFn: (scores: Record<string, string>) => saveJudgeDraft(eventId, participantId, scores), onSuccess: refresh })
  const submit = useMutation({ mutationFn: (scores: Record<string, string>) => submitJudgeScores(eventId, participantId, scores), onSuccess: refresh })

  if (detail.isLoading) return <InlineSpinner />
  if (detail.isError || !detail.data) {
    return getStatus(detail.error) === 404
      ? <ErrorState message={t('judge.not_found')} />
      : <ErrorState message={getErrorMessage(detail.error)} onRetry={() => detail.refetch()} />
  }

  const { participant, criteria, evaluation, is_weighted } = detail.data
  const submitted = evaluation.status === 'submitted'
  const next = event.data ? nextPending(event.data.participants, participantId) : null

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href={`/judge/events/${eventId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('judge.back_participants')}
        </Link>
        <p className="text-sm text-slate-500">{detail.data.event.name}</p>
        <h1 className="text-2xl font-semibold text-slate-900">#{participant.number} · {participant.name}</h1>
        {participant.team_name && <p className="text-sm text-slate-600">{participant.team_name}</p>}
        {participant.description && <p className="text-sm text-slate-600">{participant.description}</p>}
      </div>

      {justSubmitted && <Alert kind="success">{t('judge.submitted_ok')}</Alert>}
      {submitted && evaluation.total_score && <p className="text-sm font-medium text-slate-700">{t('judge.your_total', { total: evaluation.total_score })}</p>}

      <ScoreForm
        key={`${participant.id}-${evaluation.status}`}
        criteria={criteria}
        initial={evaluation.scores}
        weighted={is_weighted}
        readOnly={submitted}
        onSaveDraft={(scores) => draft.mutateAsync(scores)}
        onSubmit={async (scores) => {
          await submit.mutateAsync(scores)
          setJustSubmitted(true)
        }}
      />

      {submitted && (
        <div className="flex flex-wrap gap-3">
          <Link href={`/judge/events/${eventId}`} className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            {t('judge.back_participants')}
          </Link>
          {next && (
            <Link href={`/judge/events/${eventId}/participants/${next.id}`} className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800">
              {t('judge.next_participant')}: #{next.number}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}