'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Criterion } from '@/types'
import { useI18n } from '@/i18n/provider'
import { applyServerErrors, getErrorMessage } from '@/lib/api'
import { Field } from '@/components/ui/field'
import { CheckboxField } from '@/components/ui/checkbox-field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

const schema = z
  .object({
    name: z.string().trim().min(1, 'val.name_required').max(255, 'val.name_max'),
    description: z.string().max(2000).optional(),
    min_score: z.number({ error: 'val.number' }).min(0, 'val.nonneg'),
    max_score: z.number({ error: 'val.number' }),
    weight: z.number({ error: 'val.number' }).min(0, 'val.weight_range').max(100, 'val.weight_range'),
    is_required: z.boolean(),
    is_active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.max_score <= v.min_score) {
      ctx.addIssue({ code: 'custom', path: ['max_score'], message: 'val.max_gt_min' })
    }
  })

export type CriterionFormValues = z.infer<typeof schema>

const FIELDS = ['name', 'description', 'min_score', 'max_score', 'weight', 'is_required', 'is_active']

interface Props {
  initial?: Criterion
  weighted: boolean
  submitLabel: string
  onSubmit: (values: CriterionFormValues) => Promise<unknown>
  onCancel?: () => void
}

export function CriterionForm({ initial, weighted, submitLabel, onSubmit, onCancel }: Props) {
  const { t } = useI18n()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CriterionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      min_score: initial?.min_score ?? 0,
      max_score: initial?.max_score ?? 100,
      weight: initial?.weight ?? 0,
      is_required: initial?.is_required ?? true,
      is_active: initial?.is_active ?? true,
    },
  })

  async function submit(values: CriterionFormValues) {
    setFormError(null)
    try {
      await onSubmit({ ...values, weight: weighted ? values.weight : 0 })
      if (!initial) {
        // Keep the score range, which usually repeats, and clear the rest.
        reset({ name: '', description: '', min_score: values.min_score, max_score: values.max_score, weight: 0, is_required: true, is_active: true })
      }
    } catch (error) {
      if (!applyServerErrors(error, setError, FIELDS)) setFormError(getErrorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      {formError && <Alert kind="error">{formError}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Field label={t('forms.criterion_name')} autoComplete="off" error={errors.name?.message} {...register('name')} />
        </div>
        <Field label={t('forms.min_score')} type="number" step="0.01" error={errors.min_score?.message} {...register('min_score', { valueAsNumber: true })} />
        <Field label={t('forms.max_score')} type="number" step="0.01" error={errors.max_score?.message} {...register('max_score', { valueAsNumber: true })} />
        {weighted && (
          <Field label={t('forms.weight')} type="number" step="0.01" min={0} max={100} error={errors.weight?.message} {...register('weight', { valueAsNumber: true })} />
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="criterion-description" className="block text-sm font-medium text-slate-900">{t('forms.criterion_description')}</label>
        <textarea
          id="criterion-description"
          rows={2}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          {...register('description')}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CheckboxField label={t('forms.required')} hint={t('forms.required_hint')} {...register('is_required')} />
        <CheckboxField label={t('forms.active')} hint={t('forms.active_hint')} {...register('is_active')} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting}>{submitLabel}</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>}
      </div>
    </form>
  )
}