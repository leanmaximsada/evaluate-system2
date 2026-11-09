'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n/provider'
import type { PublicVisibility } from '@/types'
import { Modal } from '@/components/ui/modal'
import { SelectField } from '@/components/ui/select-field'
import { CheckboxField } from '@/components/ui/checkbox-field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import type { PublishPayload } from './api'

interface Props {
  defaultVisibility?: PublicVisibility
  open: boolean
  /** True when results were published before, so a correction reason is required. */
  hasPrevious: boolean
  incompleteCount: number
  loading?: boolean
  errors?: string[] | null
  onSubmit: (payload: PublishPayload) => void
  onClose: () => void
  
}

export function PublishDialog({ open, hasPrevious, incompleteCount, loading = false, errors, onSubmit, onClose, defaultVisibility }: Props) {
  const { t, tx } = useI18n()
  const [visibility, setVisibility] = useState<PublicVisibility>(defaultVisibility ?? 'rank_and_score')
  const [reason, setReason] = useState('')
  const [accept, setAccept] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function submit() {
    if (!confirm) return setError('results.err_confirm')
    if (hasPrevious && !reason.trim()) return setError('results.err_reason')
    setError(null)

    onSubmit({
      visibility,
      confirm: true,
      ...(incompleteCount > 0 && accept ? { accept_incomplete: true } : {}),
      ...(reason.trim() ? { correction_reason: reason.trim() } : {}),
    })
  }

  return (
    <Modal open={open} title={t('results.publish_title')} onClose={onClose}>
      <p className="text-sm text-slate-600">{t('results.publish_intro')}</p>

      {error && <Alert kind="error">{tx(error)}</Alert>}
      {errors?.map((message) => <Alert key={message} kind="error">{message}</Alert>)}

      <SelectField label={t('results.visibility')} value={visibility} onChange={(e) => setVisibility(e.target.value as PublicVisibility)}>
        <option value="rank_and_score">{t('results.vis_rank_and_score')}</option>
        <option value="rank_only">{t('results.vis_rank_only')}</option>
      </SelectField>

      <div className="space-y-1.5">
        <label htmlFor="publish-reason" className="block text-sm font-medium text-slate-900">{t('results.reason')}</label>
        <textarea
          id="publish-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        <p className="text-xs text-slate-500">{t('results.reason_hint')}</p>
      </div>

      {incompleteCount > 0 && (
        <CheckboxField label={t('results.accept_incomplete', { n: incompleteCount })} checked={accept} onChange={(e) => setAccept(e.target.checked)} />
      )}
      <CheckboxField label={t('results.confirm_check')} checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
        <Button onClick={submit} loading={loading}>{t('results.publish')}</Button>
      </div>
    </Modal>
  )
}