'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Participant } from '@/types'
import { useI18n } from '@/i18n/provider'
import { applyServerErrors, getErrorMessage } from '@/lib/api'
import { Field } from '@/components/ui/field'
import { SelectField } from '@/components/ui/select-field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

const schema = z.object({
  name: z.string().trim().min(1, 'val.name_required').max(255, 'val.name_max'),
  number: z.string().trim().min(1, 'val.number_required').max(20, 'val.number_max'),
  team_name: z.string().max(255).optional(),
  status: z.enum(['registered', 'withdrawn', 'disqualified']),
})

export type ParticipantFormValues = z.infer<typeof schema>

interface Props {
  initial?: Participant
  onSubmit: (values: ParticipantFormValues) => Promise<unknown>
  onCancel?: () => void
}

export function ParticipantForm({ initial, onSubmit, onCancel }: Props) {
  const { t } = useI18n()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ParticipantFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      number: initial?.number ?? '',
      team_name: initial?.team_name ?? '',
      status: initial?.status ?? 'registered',
    },
  })

  async function submit(values: ParticipantFormValues) {
    setFormError(null)
    try {
      await onSubmit(values)
      if (!initial) reset({ name: '', number: '', team_name: '', status: 'registered' })
    } catch (error) {
      if (!applyServerErrors(error, setError, ['name', 'number', 'team_name', 'status'])) setFormError(getErrorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      {formError && <Alert kind="error">{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Field label={t('participants.name')} autoComplete="off" error={errors.name?.message} {...register('name')} />
        </div>
        <Field label={t('participants.number')} autoComplete="off" error={errors.number?.message} {...register('number')} />
        <Field label={t('participants.team')} autoComplete="off" error={errors.team_name?.message} {...register('team_name')} />
        {initial && (
          <SelectField label={t('participants.status')} error={errors.status?.message} {...register('status')}>
            <option value="registered">{t('participants.status_registered')}</option>
            <option value="withdrawn">{t('participants.status_withdrawn')}</option>
            <option value="disqualified">{t('participants.status_disqualified')}</option>
          </SelectField>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting}>{initial ? t('participants.save_submit') : t('participants.add_submit')}</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>}
      </div>
    </form>
  )
}