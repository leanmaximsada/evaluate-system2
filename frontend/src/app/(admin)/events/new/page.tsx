'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createEvent } from '@/features/events/api'
import { eventKeys } from '@/features/events/hooks'
import { EventForm } from '@/features/events/event-form'
import { useI18n } from '@/i18n/provider'
import { Card } from '@/components/ui/card'

export default function NewEventPage() {
  const { t } = useI18n()
  const router = useRouter()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: createEvent,
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all })
      router.push(`/events/${event.id}`)
    },
  })

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">{t('events.new')}</h1>
      <Card>
        <EventForm submitLabel={t('events.create_submit')} cancelHref="/events" onSubmit={(v) => mutation.mutateAsync(v)} />
      </Card>
    </div>
  )
}