'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PencilSimple } from '@phosphor-icons/react'
import { changeEventStatus } from '@/features/events/api'
import { eventKeys, useEvent } from '@/features/events/hooks'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage } from '@/lib/api'
import type { EventStatus } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { Alert } from '@/components/ui/alert'
import { StatCard } from '@/components/ui/stat-card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { UsersThree, Gavel } from '@phosphor-icons/react'
import { EventFormPicker } from '@/features/events/event-form-picker'

type Feedback = { kind: 'success' | 'error'; text: string }

export default function EventOverviewPage() {
  const { t } = useI18n()
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const queryClient = useQueryClient()
  const { data: event } = useEvent(id)
  const [pending, setPending] = useState<EventStatus | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const mutation = useMutation({
    mutationFn: (status: EventStatus) => changeEventStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all })
      setFeedback({ kind: 'success', text: t('event.status_updated') })
    },
    onError: (e) => setFeedback({ kind: 'error', text: getErrorMessage(e) }),
    onSettled: () => setPending(null),
  })

  if (!event) return null

  const confirmText = (s: EventStatus) =>
    s === 'in_progress' ? t('event.confirm_in_progress')
    : s === 'completed' ? t('event.confirm_completed')
    : s === 'cancelled' ? t('event.confirm_cancelled')
    : t('event.confirm_other')

  const rows: [string, string][] = [
    [t('events.venue'), event.venue ?? '—'],
    [t('events.category'), event.category ?? '—'],
    [t('events.starts'), event.starts_at_local.replace('T', ' ')],
    [t('events.ends'), event.ends_at_local.replace('T', ' ')],
    [t('events.timezone'), event.timezone],
    [t('events.created_by'), event.created_by ?? '—'],
  ]

  return (
    <div className="space-y-6">
      {feedback && <Alert kind={feedback.kind}>{feedback.text}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label={t('events.tab_participants')} value={event.participants_count ?? 0} icon={UsersThree} />
        <StatCard label={t('events.tab_judges')} value={event.judges_count ?? 0} icon={Gavel} />
      </div>

      <Card
        title={t('events.details')}
        action={!event.is_closed ? <LinkButton href={`/events/${id}/edit`} variant="secondary"><PencilSimple className="h-4 w-4" aria-hidden="true" />{t('common.edit')}</LinkButton> : undefined}
      >
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label}><dt className="text-slate-500">{label}</dt><dd className="font-medium text-slate-900">{value}</dd></div>
          ))}
        </dl>
        {event.description && (
          <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
            <p className="text-slate-500">{t('events.description')}</p>
            <p className="mt-1 whitespace-pre-line text-slate-900">{event.description}</p>
          </div>
        )}
      </Card>

      <EventFormPicker event={event} />

      <Card title={t('events.status_card')} description={t('events.status_hint')}>
        {event.allowed_transitions.length === 0 ? (
          <p className="text-sm text-slate-500">{t('events.no_transitions')}</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {event.allowed_transitions.map((to) => (
              <Button key={to} variant={to === 'cancelled' ? 'danger' : to === 'in_progress' ? 'primary' : 'secondary'} onClick={() => setPending(to)}>
                {t(`event.action_${to}`)}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? t('event.confirm_title', { action: t(`event.action_${pending}`) }) : ''}
        message={pending ? confirmText(pending) : ''}
        confirmLabel={pending ? t(`event.action_${pending}`) : ''}
        danger={pending === 'cancelled'}
        loading={mutation.isPending}
        onConfirm={() => pending && mutation.mutate(pending)}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}