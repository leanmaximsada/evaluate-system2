'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n/provider'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

interface Props {
  open: boolean
  loading?: boolean
  errors?: string[] | null
  onSubmit: (reason: string) => void
  onClose: () => void
}

export function UnpublishDialog({ open, loading = false, errors, onSubmit, onClose }: Props) {
  const { t } = useI18n()
  const [reason, setReason] = useState('')

  return (
    <Modal open={open} title={t('results.unpublish_title')} onClose={onClose}>
      <p className="text-sm text-slate-600">{t('results.unpublish_text')}</p>
      {errors?.map((message) => <Alert key={message} kind="error">{message}</Alert>)}

      <div className="space-y-1.5">
        <label htmlFor="unpublish-reason" className="block text-sm font-medium text-slate-900">{t('results.unpublish_reason')}</label>
        <textarea
          id="unpublish-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
        <Button variant="danger" onClick={() => onSubmit(reason.trim())} loading={loading}>{t('results.unpublish')}</Button>
      </div>
    </Modal>
  )
}