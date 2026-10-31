'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { SettingsData } from '@/types'
import { useI18n } from '@/i18n/provider'
import { applyServerErrors, getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { SelectField } from '@/components/ui/select-field'
import { CheckboxField } from '@/components/ui/checkbox-field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

const DATE_FORMATS = ['Y-m-d', 'd/m/Y', 'm/d/Y', 'd M Y'] as const

const schema = z
  .object({
    general: z.object({
      system_name: z.string().trim().min(1, 'val.sysname_required').max(100, 'val.sysname_max'),
      default_language: z.enum(['en', 'km']),
      timezone: z.string().min(1, 'val.timezone_required'),
      date_format: z.enum(DATE_FORMATS),
      time_format: z.enum(['24h', '12h']),
      pagination_size: z.number({ error: 'val.number' }).int('val.whole').min(5, 'val.min5').max(100, 'val.max100'),
    }),
    evaluation: z.object({
      min_score: z.number({ error: 'val.number' }).min(0, 'val.nonneg'),
      max_score: z.number({ error: 'val.number' }),
      score_precision: z.enum(['0', '1', '2']),
      tie_policy: z.enum(['standard', 'dense']),
      show_tie_indicator: z.boolean(),
      live_provisional_enabled: z.boolean(),
      default_result_visibility: z.enum(['rank_and_score', 'rank_only', 'hidden']),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.evaluation.max_score <= v.evaluation.min_score) {
      ctx.addIssue({ code: 'custom', path: ['evaluation', 'max_score'], message: 'val.max_gt_min' })
    }
  })

type FormValues = z.infer<typeof schema>

function toFormValues(s: SettingsData): FormValues {
  return {
    general: { ...s.general },
    evaluation: { ...s.evaluation, score_precision: String(s.evaluation.score_precision) as '0' | '1' | '2' },
  }
}

interface Props {
  initial: SettingsData
  onSubmit: (values: SettingsData) => Promise<unknown>
}

export function SettingsForm({ initial, onSubmit }: Props) {
  const { t } = useI18n()
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
    return Array.from(new Set(['UTC', ...all, initial.general.timezone]))
  }, [initial.general.timezone])

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toFormValues(initial) })

  async function submit(values: FormValues) {
    setFormError(null)
    setSaved(false)
    try {
      await onSubmit({
        general: values.general,
        evaluation: { ...values.evaluation, score_precision: Number(values.evaluation.score_precision) },
      })
      reset(values)
      setSaved(true)
    } catch (error) {
      if (!applyServerErrors(error, setError)) setFormError(getErrorMessage(error))
    }
  }

  const g = errors.general
  const e = errors.evaluation

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
      {saved && <Alert kind="success">{t('settings.saved')}</Alert>}
      {formError && <Alert kind="error">{formError}</Alert>}

      <Card title={t('settings.general')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t('settings.system_name')} error={g?.system_name?.message} {...register('general.system_name')} />
          </div>
          <SelectField label={t('settings.default_language')} error={g?.default_language?.message} hint={t('settings.language_hint')} {...register('general.default_language')}>
            <option value="en">{t('settings.language_en')}</option>
            <option value="km">{t('settings.language_km')}</option>
          </SelectField>
          <SelectField label={t('settings.timezone')} error={g?.timezone?.message} {...register('general.timezone')}>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </SelectField>
          <SelectField label={t('settings.date_format')} error={g?.date_format?.message} {...register('general.date_format')}>
            <option value="Y-m-d">2026-10-28</option>
            <option value="d/m/Y">28/10/2026</option>
            <option value="m/d/Y">10/28/2026</option>
            <option value="d M Y">28 Oct 2026</option>
          </SelectField>
          <SelectField label={t('settings.time_format')} error={g?.time_format?.message} {...register('general.time_format')}>
            <option value="24h">{t('settings.time_24')}</option>
            <option value="12h">{t('settings.time_12')}</option>
          </SelectField>
          <Field
            label={t('settings.page_size')}
            type="number"
            min={5}
            max={100}
            error={g?.pagination_size?.message}
            {...register('general.pagination_size', { valueAsNumber: true })}
          />
        </div>
      </Card>

      <Card title={t('settings.evaluation')}>
        <p className="mb-4 text-sm text-slate-500">{t('settings.eval_intro')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('settings.min_score')} type="number" step="any" error={e?.min_score?.message} {...register('evaluation.min_score', { valueAsNumber: true })} />
          <Field label={t('settings.max_score')} type="number" step="any" error={e?.max_score?.message} {...register('evaluation.max_score', { valueAsNumber: true })} />
          <SelectField label={t('settings.precision')} error={e?.score_precision?.message} {...register('evaluation.score_precision')}>
            <option value="0">{t('settings.precision_0')}</option>
            <option value="1">{t('settings.precision_1')}</option>
            <option value="2">{t('settings.precision_2')}</option>
          </SelectField>
          <SelectField label={t('settings.tie_policy')} error={e?.tie_policy?.message} hint={t('settings.tie_hint')} {...register('evaluation.tie_policy')}>
            <option value="standard">{t('settings.tie_standard')}</option>
            <option value="dense">{t('settings.tie_dense')}</option>
          </SelectField>
          <div className="sm:col-span-2">
            <SelectField label={t('settings.visibility')} error={e?.default_result_visibility?.message} hint={t('settings.visibility_hint')} {...register('evaluation.default_result_visibility')}>
              <option value="rank_and_score">{t('settings.vis_rank_score')}</option>
              <option value="rank_only">{t('settings.vis_rank_only')}</option>
              <option value="hidden">{t('settings.vis_hidden')}</option>
            </SelectField>
          </div>
          <div className="space-y-3 sm:col-span-2">
            <CheckboxField label={t('settings.show_tie')} hint={t('settings.show_tie_hint')} {...register('evaluation.show_tie_indicator')} />
            <CheckboxField label={t('settings.live')} hint={t('settings.live_hint')} {...register('evaluation.live_provisional_enabled')} />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>{t('settings.save')}</Button>
        {!isDirty && !saved && <span className="text-sm text-slate-500">{t('settings.no_changes')}</span>}
      </div>
    </form>
  )
}