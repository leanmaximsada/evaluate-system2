'use client'

import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateEvent } from '@/features/events/api'
import { eventKeys, useEvent } from '@/features/events/hooks'
import { EventForm } from '@/features/events/event-form'
import { useI18n } from '@/i18n/provider'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'

export default function EditEventPage() {
  const { t } = useI18n()
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: event } = useEvent(id)

  const mutation = useMutation({
    mutationFn: (values: Parameters<typeof updateEvent>[1]) => updateEvent(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all })
      router.push(`/events/${id}`)
    },
  })

  if (!event) return null

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">{t('events.edit_title')}</h2>
      {event.is_closed ? (
        <Alert kind="info">{t('events.closed_note')}</Alert>
      ) : (
        <Card>
          <EventForm
            initial={event}
            submitLabel={t('users.save_changes')}
            cancelHref={`/events/${id}`}
            onSubmit={(v) => mutation.mutateAsync(v)}
          />
        </Card>
      )}
    </div>
  )
}