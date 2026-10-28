'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { SettingsData } from '@/types'
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
      system_name: z.string().trim().min(1, 'System name is required').max(100, 'Use at most 100 characters'),
      default_language: z.enum(['en', 'km']),
      timezone: z.string().min(1, 'Timezone is required'),
      date_format: z.enum(DATE_FORMATS),
      time_format: z.enum(['24h', '12h']),
      pagination_size: z.number({ error: 'Enter a number' }).int('Whole numbers only').min(5, 'Minimum is 5').max(100, 'Maximum is 100'),
    }),
    evaluation: z.object({
      min_score: z.number({ error: 'Enter a number' }).min(0, 'Cannot be negative'),
      max_score: z.number({ error: 'Enter a number' }),
      score_precision: z.enum(['0', '1', '2']),
      tie_policy: z.enum(['standard', 'dense']),
      show_tie_indicator: z.boolean(),
      live_provisional_enabled: z.boolean(),
      default_result_visibility: z.enum(['rank_and_score', 'rank_only', 'hidden']),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.evaluation.max_score <= v.evaluation.min_score) {
      ctx.addIssue({
        code: 'custom',
        path: ['evaluation', 'max_score'],
        message: 'Maximum score must be greater than minimum',
      })
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
      {saved && <Alert kind="success">Settings saved.</Alert>}
      {formError && <Alert kind="error">{formError}</Alert>}

      <Card title="General">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="System name" error={g?.system_name?.message} {...register('general.system_name')} />
          </div>
          <SelectField
            label="Default language"
            error={g?.default_language?.message}
            hint="Stored for later. The interface is English only for now."
            {...register('general.default_language')}
          >
            <option value="en">English</option>
            <option value="km">Khmer</option>
          </SelectField>
          <SelectField label="Default timezone" error={g?.timezone?.message} {...register('general.timezone')}>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </SelectField>
          <SelectField label="Date format" error={g?.date_format?.message} {...register('general.date_format')}>
            <option value="Y-m-d">2026-10-28</option>
            <option value="d/m/Y">28/10/2026</option>
            <option value="m/d/Y">10/28/2026</option>
            <option value="d M Y">28 Oct 2026</option>
          </SelectField>
          <SelectField label="Time format" error={g?.time_format?.message} {...register('general.time_format')}>
            <option value="24h">24-hour (14:30)</option>
            <option value="12h">12-hour (2:30 PM)</option>
          </SelectField>
          <Field
            label="Default page size"
            type="number"
            min={5}
            max={100}
            error={g?.pagination_size?.message}
            {...register('general.pagination_size', { valueAsNumber: true })}
          />
        </div>
      </Card>

      <Card title="Evaluation defaults">
        <p className="mb-4 text-sm text-slate-500">
          These are defaults for new forms and events. Events that have started keep the rules they started with.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum score" type="number" step="any" error={e?.min_score?.message} {...register('evaluation.min_score', { valueAsNumber: true })} />
          <Field label="Maximum score" type="number" step="any" error={e?.max_score?.message} {...register('evaluation.max_score', { valueAsNumber: true })} />
          <SelectField label="Score precision" error={e?.score_precision?.message} {...register('evaluation.score_precision')}>
            <option value="0">Whole numbers</option>
            <option value="1">1 decimal place</option>
            <option value="2">2 decimal places</option>
          </SelectField>
          <SelectField
            label="Tie handling"
            error={e?.tie_policy?.message}
            hint="Standard: 1, 2, 2, 4. Dense: 1, 2, 2, 3."
            {...register('evaluation.tie_policy')}
          >
            <option value="standard">Standard competition ranking</option>
            <option value="dense">Dense ranking</option>
          </SelectField>
          <div className="sm:col-span-2">
            <SelectField
              label="Default result visibility"
              error={e?.default_result_visibility?.message}
              hint="Results are only shown publicly after an administrator publishes them."
              {...register('evaluation.default_result_visibility')}
            >
              <option value="rank_and_score">Show rank and score</option>
              <option value="rank_only">Show rank only</option>
              <option value="hidden">Hidden</option>
            </SelectField>
          </div>
          <div className="space-y-3 sm:col-span-2">
            <CheckboxField label="Show tie indicator" hint="Mark participants who share a rank." {...register('evaluation.show_tie_indicator')} />
            <CheckboxField
              label="Enable live provisional results"
              hint="Allow the results screen to update while judges are still scoring."
              {...register('evaluation.live_provisional_enabled')}
            />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save settings</Button>
        {!isDirty && !saved && <span className="text-sm text-slate-500">No unsaved changes</span>}
      </div>
    </form>
  )
}