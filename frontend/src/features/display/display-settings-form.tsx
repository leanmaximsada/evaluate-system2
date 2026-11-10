'use client'

import { useEffect, useRef, useState } from 'react'
import type { EventItem, PublicVisibility } from '@/types'
import { useI18n } from '@/i18n/provider'
import { getErrorMessages } from '@/lib/api'
import { Field } from '@/components/ui/field'
import { SelectField } from '@/components/ui/select-field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import type { DisplaySettingsInput } from './api'

const TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 2 * 1024 * 1024

interface Props {
  event: EventItem
  onSave: (input: DisplaySettingsInput) => Promise<unknown>
  onUploadLogo: (file: File) => Promise<unknown>
  onRemoveLogo: () => Promise<unknown>
}

export function DisplaySettingsForm({ event, onSave, onUploadLogo, onRemoveLogo }: Props) {
  const { t, tx } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(event.organization_name ?? '')
  const [subtitle, setSubtitle] = useState(event.public_subtitle ?? '')
  const [visibility, setVisibility] = useState<PublicVisibility>(event.display_visibility)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState<'save' | 'logo' | null>(null)

  useEffect(() => {
    setName(event.organization_name ?? '')
    setSubtitle(event.public_subtitle ?? '')
    setVisibility(event.display_visibility)
  }, [event.organization_name, event.public_subtitle, event.display_visibility])

  async function save() {
    const found: Record<string, string> = {}
    if (name.trim().length > 150) found.name = 'display.err_name_long'
    if (subtitle.length > 500) found.subtitle = 'display.err_subtitle_long'
    setErrors(found)
    setMessages([])
    setSaved(false)
    if (Object.keys(found).length > 0) return

    setBusy('save')
    try {
      await onSave({ organization_name: name.trim(), public_subtitle: subtitle, display_visibility: visibility })
      setSaved(true)
    } catch (error) {
      setMessages(getErrorMessages(error))
    } finally {
      setBusy(null)
    }
  }

  async function pick(file: File | undefined) {
    setMessages([])
    setErrors((e) => ({ ...e, logo: '' }))
    if (!file) return
    if (!TYPES.includes(file.type)) return setErrors((e) => ({ ...e, logo: 'sponsors.err_logo_type' }))
    if (file.size > MAX_BYTES) return setErrors((e) => ({ ...e, logo: 'sponsors.err_logo_size' }))

    setBusy('logo')
    try {
      await onUploadLogo(file)
    } catch (error) {
      setMessages(getErrorMessages(error))
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removeLogo() {
    setBusy('logo')
    try {
      await onRemoveLogo()
    } catch (error) {
      setMessages(getErrorMessages(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      {saved && <Alert kind="success">{t('display.settings_saved')}</Alert>}
      {messages.map((m) => <Alert key={m} kind="error">{m}</Alert>)}

      <Field label={t('display.org_name')} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />

      <div className="space-y-1.5">
        <label htmlFor="org-logo" className="block text-sm font-medium text-slate-900">{t('display.org_logo')}</label>
        <input
          id="org-logo"
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy !== null}
          onChange={(e) => void pick(e.target.files?.[0])}
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
        />
        <p className="text-xs text-slate-500">{t('display.org_logo_hint')}</p>
        {errors.logo && <p role="alert" className="text-sm text-red-600">{tx(errors.logo)}</p>}
        {event.organization_logo_url && (
          <div className="mt-2 flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-[#ffffff] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={event.organization_logo_url} alt={t('display.org_logo')} className="max-h-16 max-w-48 object-contain" />
            </div>
            <Button variant="secondary" onClick={() => void removeLogo()} disabled={busy !== null}>{t('display.org_logo_remove')}</Button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="display-subtitle" className="block text-sm font-medium text-slate-900">{t('display.subtitle')}</label>
        <textarea
          id="display-subtitle"
          rows={3}
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        <p className="text-xs text-slate-500">{t('display.subtitle_hint')}</p>
        {errors.subtitle && <p role="alert" className="text-sm text-red-600">{tx(errors.subtitle)}</p>}
      </div>

      <SelectField label={t('display.visibility')} hint={t('display.visibility_hint')} value={visibility} onChange={(e) => setVisibility(e.target.value as PublicVisibility)}>
        <option value="rank_and_score">{t('results.vis_rank_and_score')}</option>
        <option value="rank_only">{t('results.vis_rank_only')}</option>
      </SelectField>

      <Button onClick={() => void save()} loading={busy === 'save'} disabled={busy === 'logo'}>{t('display.save')}</Button>
    </div>
  )
}