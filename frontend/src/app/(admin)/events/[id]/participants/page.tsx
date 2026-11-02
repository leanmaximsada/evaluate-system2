'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, PencilSimple, Trash } from '@phosphor-icons/react'
import { createParticipant, deleteParticipant, reorderParticipants, updateParticipant } from '@/features/events/api'
import { eventKeys, useEvent, useParticipants } from '@/features/events/hooks'
import { ParticipantForm, type ParticipantFormValues } from '@/features/events/participant-form'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage } from '@/lib/api'
import type { Participant } from '@/types'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

const tone = {
  registered: 'bg-green-50 text-green-700 ring-green-200',
  withdrawn: 'bg-slate-100 text-slate-600 ring-slate-200',
  disqualified: 'bg-red-50 text-red-700 ring-red-200',
}
const iconBtn = 'rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40'

export default function ParticipantsPage() {
  const { t } = useI18n()
  const params = useParams<{ id: string }>()
  const eventId = Number(params.id)
  const queryClient = useQueryClient()
  const { data: event } = useEvent(eventId)
  const { data: list, isLoading, isError, error, refetch } = useParticipants(eventId)

  const [editing, setEditing] = useState<Participant | null>(null)
  const [toDelete, setToDelete] = useState<Participant | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: eventKeys.all })
  const onError = (e: unknown) => setFeedback(getErrorMessage(e))

  const save = useMutation({
    mutationFn: (v: ParticipantFormValues) => (editing ? updateParticipant(eventId, editing.id, v) : createParticipant(eventId, v)),
    onSuccess: () => { setEditing(null); setFeedback(null); refresh() },
  })
  const remove = useMutation({
    mutationFn: (p: Participant) => deleteParticipant(eventId, p.id),
    onSuccess: () => { setFeedback(null); refresh() },
    onError,
    onSettled: () => setToDelete(null),
  })
  const reorder = useMutation({
    mutationFn: (ids: number[]) => reorderParticipants(eventId, ids),
    onSuccess: () => { setFeedback(null); refresh() },
    onError,
  })

  if (!event) return null

  const canAdd = !event.is_structure_locked
  const canEdit = !event.is_closed

  function move(index: number, delta: number) {
    if (!list) return
    const ids = list.map((p) => p.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorder.mutate(ids)
  }

  return (
    <div className="space-y-6">
      {feedback && <Alert kind="error">{feedback}</Alert>}
      {event.is_closed ? <Alert kind="info">{t('participants.closed_note')}</Alert>
        : event.is_structure_locked ? <Alert kind="info">{t('participants.locked_note')}</Alert> : null}

      {(canAdd || editing) && canEdit && (
        <Card title={editing ? t('participants.edit') : t('participants.add')}>
          <ParticipantForm
            key={editing?.id ?? 'new'}
            initial={editing ?? undefined}
            onSubmit={(v) => save.mutateAsync(v)}
            onCancel={editing ? () => setEditing(null) : undefined}
          />
        </Card>
      )}

      <Card title={t('events.tab_participants')}>
        {isLoading ? (
          <InlineSpinner />
        ) : isError || !list ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t('participants.none')}</p>
        ) : (
          <div className={`overflow-x-auto ${reorder.isPending ? 'opacity-70' : ''}`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">{t('participants.col_order')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('participants.number')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('participants.name')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('participants.team')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('participants.status')}</th>
                  {canEdit && <th scope="col" className="px-3 py-2 text-right font-medium">{t('participants.col_actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((p, i) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 text-slate-600">{p.presentation_order}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{p.number}</td>
                    <td className="px-3 py-3 text-slate-900">{p.name}</td>
                    <td className="px-3 py-3 text-slate-600">{p.team_name ?? '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone[p.status]}`}>
                        {t(`participants.status_${p.status}`)}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button className={iconBtn} aria-label={t('participants.move_up')} disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                          <button className={iconBtn} aria-label={t('participants.move_down')} disabled={i === list.length - 1 || reorder.isPending} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                          <button className={iconBtn} aria-label={t('common.edit')} onClick={() => setEditing(p)}><PencilSimple className="h-4 w-4" /></button>
                          {canAdd && <button className={iconBtn} aria-label={t('common.delete')} onClick={() => setToDelete(p)}><Trash className="h-4 w-4" /></button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={toDelete !== null}
        title={t('participants.delete_title')}
        message={toDelete ? t('participants.delete_text', { name: toDelete.name }) : ''}
        confirmLabel={t('common.delete')}
        danger
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}