'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { EventItem } from '@/types'
import { useI18n } from '@/i18n/provider'
import { applyServerErrors, getErrorMessage } from '@/lib/api'
import { Field } from '@/components/ui/field'
import { SelectField } from '@/components/ui/select-field'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { Alert } from '@/components/ui/alert'

const schema = z
  .object({
    name: z.string().trim().min(1, 'val.name_required').max(255, 'val.name_max'),
    code: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{1,49}$/, 'val.code_format'),
    description: z.string().max(5000).optional(),
    venue: z.string().max(255).optional(),
    category: z.string().max(100).optional(),
    timezone: z.string().min(1, 'val.timezone_required'),
    starts_at: z.string().min(1, 'val.date_required'),
    ends_at: z.string().min(1, 'val.date_required'),
  })
  .superRefine((v, ctx) => {
    // "YYYY-MM-DDTHH:mm" strings compare correctly as text.
    if (v.starts_at && v.ends_at && v.ends_at < v.starts_at) {
      ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'val.end_after_start' })
    }
  })

export type EventFormValues = z.infer<typeof schema>

const FIELDS = ['name', 'code', 'description', 'venue', 'category', 'timezone', 'starts_at', 'ends_at']

interface Props {
  initial?: EventItem
  submitLabel: string
  cancelHref: string
  onSubmit: (values: EventFormValues) => Promise<unknown>
}

export function EventForm({ initial, submitLabel, cancelHref, onSubmit }: Props) {
  const { t } = useI18n()
  const [formError, setFormError] = useState<string | null>(null)
  const locked = initial?.is_structure_locked ?? false

  const browserZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
    return Array.from(new Set(['UTC', ...all, browserZone, initial?.timezone ?? 'UTC']))
  }, [browserZone, initial?.timezone])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      code: initial?.code ?? '',
      description: initial?.description ?? '',
      venue: initial?.venue ?? '',
      category: initial?.category ?? '',
      timezone: initial?.timezone ?? browserZone,
      starts_at: initial?.starts_at_local ?? '',
      ends_at: initial?.ends_at_local ?? '',
    },
  })

  async function submit(values: EventFormValues) {
    setFormError(null)
    try {
      await onSubmit(values)
    } catch (error) {
      if (!applyServerErrors(error, setError, FIELDS)) setFormError(getErrorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      {formError && <Alert kind="error">{formError}</Alert>}
      {locked && <Alert kind="info">{t('eventform.locked_note')}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('eventform.name')} autoComplete="off" error={errors.name?.message} {...register('name')} />
        <div className="space-y-1">
          <Field label={t('eventform.code')} autoComplete="off" readOnly={locked} error={errors.code?.message} {...register('code')} />
          <p className="text-xs text-slate-500">{t('eventform.code_hint')}</p>
        </div>
        <Field label={t('eventform.venue')} autoComplete="off" error={errors.venue?.message} {...register('venue')} />
        <Field label={t('eventform.category')} autoComplete="off" error={errors.category?.message} {...register('category')} />
        {locked ? (
          <Field label={t('eventform.timezone')} readOnly error={errors.timezone?.message} {...register('timezone')} />
        ) : (
          <SelectField label={t('eventform.timezone')} error={errors.timezone?.message} {...register('timezone')}>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </SelectField>
        )}
        <div className="hidden sm:block" />
        <Field label={t('eventform.starts')} type="datetime-local" readOnly={locked} error={errors.starts_at?.message} {...register('starts_at')} />
        <Field label={t('eventform.ends')} type="datetime-local" readOnly={locked} error={errors.ends_at?.message} {...register('ends_at')} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="event-description" className="block text-sm font-medium text-slate-900">{t('eventform.description')}</label>
        <textarea
          id="event-description"
          rows={4}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          {...register('description')}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting}>{submitLabel}</Button>
        <LinkButton href={cancelHref} variant="secondary">{t('common.cancel')}</LinkButton>
      </div>
    </form>
  )
}