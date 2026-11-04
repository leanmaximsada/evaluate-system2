'use client'

import { useState } from 'react'
import type { AxiosError } from 'axios'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage } from '@/lib/api'
import type { Criterion } from '@/types'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'

const NUMBER = /^\d+(\.\d{1,2})?$/

type Scores = Record<string, string>

interface Props {
  criteria: Criterion[]
  initial: Scores
  weighted: boolean
  readOnly: boolean
  onSaveDraft: (scores: Scores) => Promise<unknown>
  onSubmit: (scores: Scores) => Promise<unknown>
}

/** Splits a failed request into messages for single criteria ("scores.12") and general messages. */
function splitErrors(error: unknown): { fields: Record<string, string>; general: string[] } {
  const err = error as AxiosError<{ errors?: Record<string, string[]> }>
  const errors = err?.response?.status === 422 ? err.response.data?.errors : undefined
  const fields: Record<string, string> = {}
  const general: string[] = []

  if (!errors) return { fields, general: [getErrorMessage(error)] }

  for (const [key, messages] of Object.entries(errors)) {
    if (key.startsWith('scores.')) fields[key.slice('scores.'.length)] = messages[0]
    else general.push(messages[0])
  }
  return { fields, general }
}

export function ScoreForm({ criteria, initial, weighted, readOnly, onSaveDraft, onSubmit }: Props) {
  const { t } = useI18n()
  const [values, setValues] = useState<Scores>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null)

  function validate(forSubmit: boolean): { ok: boolean; clean: Scores } {
    const found: Record<string, string> = {}
    const clean: Scores = {}

    for (const c of criteria) {
      const raw = (values[c.id] ?? '').trim()
      if (raw === '') {
        if (forSubmit && c.is_required) found[c.id] = t('judge.err_required')
        continue
      }
      if (!NUMBER.test(raw)) { found[c.id] = t('judge.err_number'); continue }
      const n = Number(raw)
      if (n < c.min_score || n > c.max_score) { found[c.id] = t('judge.err_range', { min: c.min_score, max: c.max_score }); continue }
      clean[c.id] = raw
    }

    setErrors(found)
    setGeneral([])
    setMessage(null)

    if (Object.keys(found).length > 0) {
      setGeneral([t('judge.errors_fix')])
      return { ok: false, clean }
    }
    if (Object.keys(clean).length === 0) {
      setGeneral([t('judge.err_none')])
      return { ok: false, clean }
    }
    return { ok: true, clean }
  }

  async function run(kind: 'draft' | 'submit', action: (scores: Scores) => Promise<unknown>, scores: Scores) {
    setBusy(kind)
    try {
      await action(scores)
      if (kind === 'draft') setMessage(t('judge.draft_saved'))
    } catch (error) {
      const split = splitErrors(error)
      setErrors(split.fields)
      setGeneral(split.general)
    } finally {
      setBusy(null)
      setConfirming(false)
    }
  }

  function saveDraft() {
    const { ok, clean } = validate(false)
    if (ok) void run('draft', onSaveDraft, clean)
  }

  function askToSubmit() {
    const { ok } = validate(true)
    if (ok) setConfirming(true)
  }

  function confirmSubmit() {
    const { clean } = validate(true)
    void run('submit', onSubmit, clean)
  }

  return (
    <div className="space-y-5">
      {readOnly && <Alert kind="info">{t('judge.submitted_note')}</Alert>}
      {message && <Alert kind="success">{message}</Alert>}
      {general.map((text) => <Alert key={text} kind="error">{text}</Alert>)}

      <ul className="space-y-4">
        {criteria.map((c) => (
          <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <label htmlFor={`score-${c.id}`} className="text-base font-medium text-slate-900">{c.name}</label>
                {c.description && <p className="mt-1 text-sm text-slate-600">{c.description}</p>}
              </div>
              <p className="text-xs text-slate-500">
                {t('judge.range', { min: c.min_score, max: c.max_score })}
                {weighted && c.weight > 0 ? ` · ${t('judge.weight', { w: c.weight })}` : ''}
                {` · ${c.is_required ? t('judge.required') : t('judge.optional')}`}
              </p>
            </div>
            <input
              id={`score-${c.id}`}
              type="number"
              inputMode="decimal"
              step="any"
              disabled={readOnly}
              value={values[c.id] ?? ''}
              aria-invalid={!!errors[c.id]}
              aria-describedby={errors[c.id] ? `score-${c.id}-error` : undefined}
              onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))}
              className={`mt-3 h-12 w-full max-w-xs rounded-lg border px-3 text-lg shadow-sm focus:outline-none focus:ring-2 disabled:bg-slate-50 ${
                errors[c.id] ? 'border-red-500 focus:ring-red-500/15' : 'border-slate-300 focus:border-slate-900 focus:ring-slate-900/10'
              }`}
            />
            {errors[c.id] && <p id={`score-${c.id}-error`} role="alert" className="mt-2 text-sm text-red-600">{errors[c.id]}</p>}
          </li>
        ))}
      </ul>

      {!readOnly && (
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={saveDraft} loading={busy === 'draft'} disabled={busy !== null}>{t('judge.save_draft')}</Button>
          <Button onClick={askToSubmit} disabled={busy !== null}>{t('judge.submit')}</Button>
        </div>
      )}

      <Modal open={confirming} title={t('judge.confirm_title')} onClose={() => setConfirming(false)}>
        <p className="text-sm text-slate-600">{t('judge.confirm_text')}</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy === 'submit'}>{t('common.cancel')}</Button>
          <Button onClick={confirmSubmit} loading={busy === 'submit'}>{t('judge.confirm_submit')}</Button>
        </div>
      </Modal>
    </div>
  )
}