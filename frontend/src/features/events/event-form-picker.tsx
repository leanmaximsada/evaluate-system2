'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { assignEventForm, clearEventForm } from './api'
import { eventKeys } from './hooks'
import { useForms } from '@/features/forms/hooks'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage } from '@/lib/api'
import type { EventItem } from '@/types'
import { Card } from '@/components/ui/card'
import { SelectField } from '@/components/ui/select-field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

export function EventFormPicker({ event }: { event: EventItem }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const locked = event.is_structure_locked
  const forms = useForms({ status: 'active', per_page: 100 }, !locked)
  const [formId, setFormId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const options = (forms.data?.data ?? []).filter((f) => f.latest_published_version !== null)

  const done = () => { setError(null); setFormId(''); queryClient.invalidateQueries({ queryKey: eventKeys.all }) }
  const assign = useMutation({ mutationFn: () => assignEventForm(event.id, Number(formId)), onSuccess: done, onError: (e) => setError(getErrorMessage(e)) })
  const clear = useMutation({ mutationFn: () => clearEventForm(event.id), onSuccess: done, onError: (e) => setError(getErrorMessage(e)) })

  return (
    <Card title={t('events.form_card')}>
      <div className="space-y-4">
        {error && <Alert kind="error">{error}</Alert>}

        {event.form ? (
          <p className="text-sm text-slate-900">{t('events.form_current', { name: event.form.name ?? '', n: event.form.version_number })}</p>
        ) : (
          <p className="text-sm text-slate-500">{t('events.form_none')}</p>
        )}

        {locked ? (
          <p className="text-xs text-slate-500">{t('events.form_locked')}</p>
        ) : options.length === 0 && !forms.isLoading ? (
          <p className="text-sm text-slate-500">{t('events.form_none_available')}</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <SelectField label={t('events.form_choose')} hint={t('events.form_hint')} value={formId} onChange={(e) => setFormId(e.target.value)}>
                <option value="">—</option>
                {options.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({t('forms.version_label', { n: f.latest_published_version ?? 0 })})</option>
                ))}
              </SelectField>
            </div>
            <Button onClick={() => assign.mutate()} disabled={!formId} loading={assign.isPending}>{t('events.form_assign')}</Button>
            {event.form && <Button variant="secondary" onClick={() => clear.mutate()} loading={clear.isPending}>{t('events.form_clear')}</Button>}
          </div>
        )}
      </div>
    </Card>
  )
}