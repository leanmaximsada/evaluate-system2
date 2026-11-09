'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { AxiosError } from 'axios'
import type { Sponsor, SponsorTier } from '@/types'
import { useI18n } from '@/i18n/provider'
import { applyServerErrors, getErrorMessage } from '@/lib/api'
import { Field } from '@/components/ui/field'
import { SelectField } from '@/components/ui/select-field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import type { SponsorInput } from './api'

const schema = z.object({
  name: z.string().trim().min(1, 'val.name_required').max(150, 'val.name_max150'),
  tier: z.enum(['diamond', 'gold', 'silver', 'supporter']),
})
type FormValues = z.infer<typeof schema>

const TIERS: SponsorTier[] = ['diamond', 'gold', 'silver', 'supporter']
const TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 2 * 1024 * 1024

interface Props {
  initial?: Sponsor
  onSubmit: (input: SponsorInput) => Promise<unknown>
  onCancel?: () => void
}

export function SponsorForm({ initial, onSubmit, onCancel }: Props) {
  const { t, tx } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: initial?.name ?? '', tier: initial?.tier ?? 'gold' },
  })

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function pick(chosen: File | undefined) {
    setLogoError(null)
    if (!chosen) return setFile(null)
    if (!TYPES.includes(chosen.type)) { setFile(null); return setLogoError('sponsors.err_logo_type') }
    if (chosen.size > MAX_BYTES) { setFile(null); return setLogoError('sponsors.err_logo_size') }
    setFile(chosen)
  }

  async function submit(values: FormValues) {
    setFormError(null)
    if (!initial && !file) return setLogoError('sponsors.err_logo_required')

    try {
      await onSubmit({ name: values.name, tier: values.tier, logo: file })
      if (!initial) {
        reset({ name: '', tier: values.tier })
        setFile(null)
        if (fileRef.current) fileRef.current.value = ''
      }
    } catch (error) {
      const serverLogo = (error as AxiosError<{ errors?: Record<string, string[]> }>)?.response?.data?.errors?.logo?.[0]
      if (serverLogo) setLogoError(serverLogo)
      if (!applyServerErrors(error, setError, ['name', 'tier']) && !serverLogo) setFormError(getErrorMessage(error))
    }
  }

  return (
    <form
      onSubmit={handleSubmit(submit, () => {
        if (!initial && !file) setLogoError('sponsors.err_logo_required')
      })}
      className="space-y-4"
      noValidate
    >
      {formError && <Alert kind="error">{formError}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('sponsors.name')} autoComplete="off" error={errors.name?.message} {...register('name')} />
        <SelectField label={t('sponsors.tier')} error={errors.tier?.message} {...register('tier')}>
          {TIERS.map((tier) => <option key={tier} value={tier}>{t(`sponsor.tier_${tier}`)}</option>)}
        </SelectField>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="sponsor-logo" className="block text-sm font-medium text-slate-900">{t('sponsors.logo')}</label>
        <input
          id="sponsor-logo"
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => pick(e.target.files?.[0])}
          aria-invalid={!!logoError}
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
        />
        <p className="text-xs text-slate-500">{t('sponsors.logo_hint')}{initial ? ` ${t('sponsors.logo_keep')}` : ''}</p>
        {logoError && <p role="alert" className="text-sm text-red-600">{tx(logoError)}</p>}
        {(preview ?? initial?.logo_url) && (
          <div className="mt-2 inline-flex rounded-lg border border-slate-200 bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview ?? initial?.logo_url} alt={t('sponsors.logo')} className="max-h-16 max-w-48 object-contain" />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting}>{initial ? t('sponsors.save') : t('sponsors.add')}</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>}
      </div>
    </form>
  )
}