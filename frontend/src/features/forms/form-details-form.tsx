'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useI18n } from '@/i18n/provider'
import { applyServerErrors, getErrorMessage } from '@/lib/api'
import { Field } from '@/components/ui/field'
import { CheckboxField } from '@/components/ui/checkbox-field'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { Alert } from '@/components/ui/alert'

const schema = z.object({
  name: z.string().trim().min(1, 'val.name_required').max(255, 'val.name_max'),
  description: z.string().max(5000).optional(),
  is_weighted: z.boolean(),
})

export type FormDetailsValues = z.infer<typeof schema>

interface Props {
  initial?: { name: string; description: string | null }
  showWeighted?: boolean
  submitLabel: string
  cancelHref?: string
  onCancel?: () => void
  onSubmit: (values: FormDetailsValues) => Promise<unknown>
}

export function FormDetailsForm({ initial, showWeighted = false, submitLabel, cancelHref, onCancel, onSubmit }: Props) {
  const { t } = useI18n()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormDetailsValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: initial?.name ?? '', description: initial?.description ?? '', is_weighted: true },
  })

  async function submit(values: FormDetailsValues) {
    setFormError(null)
    try {
      await onSubmit(values)
    } catch (error) {
      if (!applyServerErrors(error, setError, ['name', 'description', 'is_weighted'])) setFormError(getErrorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      {formError && <Alert kind="error">{formError}</Alert>}
      <Field label={t('forms.name')} autoComplete="off" error={errors.name?.message} {...register('name')} />
      <div className="space-y-1.5">
        <label htmlFor="form-description" className="block text-sm font-medium text-slate-900">{t('forms.description')}</label>
        <textarea
          id="form-description"
          rows={3}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          {...register('description')}
        />
      </div>
      {showWeighted && <CheckboxField label={t('forms.weighted')} hint={t('forms.weighted_hint')} {...register('is_weighted')} />}
      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting}>{submitLabel}</Button>
        {cancelHref && <LinkButton href={cancelHref} variant="secondary">{t('common.cancel')}</LinkButton>}
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>}
      </div>
    </form>
  )
}