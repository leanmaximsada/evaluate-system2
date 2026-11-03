'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowUp, PencilSimple, Trash } from '@phosphor-icons/react'
import {
  addCriterion, createFormVersion, deleteCriterion, publishFormVersion, reorderCriteria,
  setFormStatus, updateCriterion, updateForm, updateFormVersion,
} from '@/features/forms/api'
import { formKeys, useEvaluationForm, useFormVersion } from '@/features/forms/hooks'
import { CriterionForm, type CriterionFormValues } from '@/features/forms/criterion-form'
import { FormDetailsForm } from '@/features/forms/form-details-form'
import { FormPreview } from '@/features/forms/form-preview'
import { useI18n } from '@/i18n/provider'
import type { MessageKey } from '@/i18n/messages/en'
import { getErrorMessage, getStatus } from '@/lib/api'
import type { Criterion } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { FormStatusBadge } from '@/components/ui/form-status-badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

const iconBtn = 'rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40'

type Feedback = { kind: 'success' | 'error'; text: string }

export default function FormBuilderPage() {
  const { t, formatDate } = useI18n()
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const queryClient = useQueryClient()

  const { data: form, isLoading, isError, error, refetch } = useEvaluationForm(id)

  const [selected, setSelected] = useState<number | null>(null)
  const [editingDetails, setEditingDetails] = useState(false)
  const [editingCriterion, setEditingCriterion] = useState<Criterion | null>(null)
  const [toDelete, setToDelete] = useState<Criterion | null>(null)
  const [confirm, setConfirm] = useState<'publish' | 'new_version' | 'status' | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  // Open the draft if there is one, otherwise the newest published version.
  const versions = form?.versions ?? []
  const draft = versions.find((v) => v.status === 'draft')
  const newest = [...versions].sort((a, b) => b.version_number - a.version_number)[0]
  const currentId = selected !== null && versions.some((v) => v.id === selected) ? selected : (draft ?? newest)?.id
  const versionQuery = useFormVersion(id, currentId)

  const refresh = () => queryClient.invalidateQueries({ queryKey: formKeys.all })
  const fail = (e: unknown) => setFeedback({ kind: 'error', text: getErrorMessage(e) })
  const ok = (text?: string) => { setFeedback(text ? { kind: 'success', text } : null); refresh() }

  const saveDetails = useMutation({
    mutationFn: (v: { name: string; description?: string }) => updateForm(id, v),
    onSuccess: () => { setEditingDetails(false); ok() },
  })
  const toggleWeighted = useMutation({
    mutationFn: (weighted: boolean) => updateFormVersion(id, currentId as number, weighted),
    onSuccess: () => ok(),
    onError: fail,
  })
  const saveCriterion = useMutation({
    mutationFn: (v: CriterionFormValues) =>
      editingCriterion
        ? updateCriterion(id, currentId as number, editingCriterion.id, v)
        : addCriterion(id, currentId as number, v),
    onSuccess: () => { setEditingCriterion(null); ok() },
  })
  const removeCriterion = useMutation({
    mutationFn: (c: Criterion) => deleteCriterion(id, currentId as number, c.id),
    onSuccess: () => ok(),
    onError: fail,
    onSettled: () => setToDelete(null),
  })
  const reorder = useMutation({
    mutationFn: (ids: number[]) => reorderCriteria(id, currentId as number, ids),
    onSuccess: () => ok(),
    onError: fail,
  })
  const publish = useMutation({
    mutationFn: () => publishFormVersion(id, currentId as number),
    onSuccess: () => ok(t('forms.published_ok')),
    onError: fail,
    onSettled: () => setConfirm(null),
  })
  const newVersion = useMutation({
    mutationFn: () => createFormVersion(id),
    onSuccess: (v) => { setSelected(v.id); ok() },
    onError: fail,
    onSettled: () => setConfirm(null),
  })
  const changeStatus = useMutation({
    mutationFn: (status: 'active' | 'inactive') => setFormStatus(id, status),
    onSuccess: () => ok(),
    onError: fail,
    onSettled: () => setConfirm(null),
  })

  if (isLoading) return <InlineSpinner />
  if (isError || !form) {
    return getStatus(error) === 404
      ? <ErrorState message={t('forms.not_found')} />
      : <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
  }

  const version = versionQuery.data
  const isDraft = version?.status === 'draft'
  const issues = version?.publish_issues ?? []
  const nextStatus = form.status === 'active' ? 'inactive' : 'active'

  function move(index: number, delta: number) {
    if (!version) return
    const ids = version.criteria.map((c) => c.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorder.mutate(ids)
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-3">
        <Link href="/forms" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('forms.title')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{form.name}</h1>
            <FormStatusBadge status={form.status} />
          </div>
          {form.status !== 'draft' && (
            <Button variant="secondary" onClick={() => setConfirm('status')}>
              {form.status === 'active' ? t('forms.deactivate') : t('forms.activate')}
            </Button>
          )}
        </div>
      </div>

      {feedback && <Alert kind={feedback.kind}>{feedback.text}</Alert>}

      <Card
        title={t('forms.details')}
        action={!editingDetails ? (
          <Button variant="secondary" onClick={() => setEditingDetails(true)}>
            <PencilSimple className="h-4 w-4" aria-hidden="true" />{t('common.edit')}
          </Button>
        ) : undefined}
      >
        {editingDetails ? (
          <FormDetailsForm
            initial={form}
            submitLabel={t('forms.save_details')}
            onCancel={() => setEditingDetails(false)}
            onSubmit={(v) => saveDetails.mutateAsync({ name: v.name, description: v.description })}
          />
        ) : (
          <p className="whitespace-pre-line text-sm text-slate-700">{form.description || '—'}</p>
        )}
      </Card>

      <Card
        title={t('forms.versions')}
        action={!draft && newest ? (
          <Button variant="secondary" onClick={() => setConfirm('new_version')}>{t('forms.new_version')}</Button>
        ) : undefined}
      >
        <div className="flex flex-wrap gap-2">
          {versions.map((v) => (
            <button
              key={v.id}
              aria-pressed={v.id === currentId}
              onClick={() => setSelected(v.id)}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                v.id === currentId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="font-medium">{t('forms.version_label', { n: v.version_number })}</span>
              <span className="ml-2 text-xs opacity-80">
                {v.status === 'published' ? t('forms.version_published') : t('forms.version_draft')}
                {v.published_at && ` · ${formatDate(v.published_at)}`}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {versionQuery.isLoading ? (
        <InlineSpinner />
      ) : versionQuery.isError || !version ? (
        <ErrorState message={getErrorMessage(versionQuery.error)} onRetry={() => versionQuery.refetch()} />
      ) : (
        <>
          {!isDraft && <Alert kind="info">{t('forms.published_note')}</Alert>}

          <Card
            title={t('forms.criteria')}
            action={isDraft ? (
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-slate-900"
                  checked={version.is_weighted}
                  disabled={toggleWeighted.isPending}
                  onChange={(e) => toggleWeighted.mutate(e.target.checked)}
                />
                {t('forms.weighted')}
              </label>
            ) : undefined}
          >
            {version.criteria.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">{t('forms.criteria_none')}</p>
            ) : (
              <div className={`overflow-x-auto ${reorder.isPending ? 'opacity-70' : ''}`}>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">{t('forms.col_order')}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t('forms.col_criterion')}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t('forms.col_range')}</th>
                      {version.is_weighted && <th scope="col" className="px-3 py-2 font-medium">{t('forms.col_weight')}</th>}
                      <th scope="col" className="px-3 py-2 font-medium">{t('forms.col_required')}</th>
                      <th scope="col" className="px-3 py-2 font-medium">{t('forms.col_active')}</th>
                      {isDraft && <th scope="col" className="px-3 py-2 text-right font-medium">{t('common.actions')}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {version.criteria.map((c, i) => (
                      <tr key={c.id} className={`hover:bg-slate-50 ${c.is_active ? '' : 'text-slate-400'}`}>
                        <td className="px-3 py-3">{c.display_order}</td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-slate-900">{c.name}</p>
                          {c.description && <p className="text-xs text-slate-500">{c.description}</p>}
                        </td>
                        <td className="px-3 py-3">{c.min_score} – {c.max_score}</td>
                        {version.is_weighted && <td className="px-3 py-3">{c.weight}%</td>}
                        <td className="px-3 py-3">{c.is_required ? t('common.yes') : t('common.no')}</td>
                        <td className="px-3 py-3">{c.is_active ? t('common.yes') : t('common.no')}</td>
                        {isDraft && (
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-1">
                              <button className={iconBtn} aria-label={t('participants.move_up')} disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                              <button className={iconBtn} aria-label={t('participants.move_down')} disabled={i === version.criteria.length - 1 || reorder.isPending} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                              <button className={iconBtn} aria-label={t('common.edit')} onClick={() => setEditingCriterion(c)}><PencilSimple className="h-4 w-4" /></button>
                              <button className={iconBtn} aria-label={t('common.delete')} onClick={() => setToDelete(c)}><Trash className="h-4 w-4" /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {version.is_weighted && (
              <p className={`mt-4 text-sm font-medium ${version.weight_total === 100 ? 'text-green-700' : 'text-amber-700'}`}>
                {t('forms.weight_total')}: {version.weight_total}%
                {version.weight_total === 100 && ` · ${t('forms.weight_ok')}`}
              </p>
            )}
          </Card>

          {isDraft && (
            <Card title={editingCriterion ? t('forms.edit_criterion') : t('forms.add_criterion')}>
              <CriterionForm
                key={editingCriterion?.id ?? `new-${version.id}-${version.is_weighted}`}
                initial={editingCriterion ?? undefined}
                weighted={version.is_weighted}
                submitLabel={editingCriterion ? t('forms.save_criterion') : t('forms.add_criterion')}
                onSubmit={(v) => saveCriterion.mutateAsync(v)}
                onCancel={editingCriterion ? () => setEditingCriterion(null) : undefined}
              />
            </Card>
          )}

          {isDraft && (
            <Card title={t('forms.publish')}>
              {issues.length > 0 && (
                <div className="mb-4 space-y-1 text-sm text-amber-800">
                  <p className="font-medium">{t('forms.publish_blocked')}</p>
                  <ul className="list-disc pl-5">
                    {issues.map((code) => <li key={code}>{t(`forms.issue_${code}` as MessageKey)}</li>)}
                  </ul>
                </div>
              )}
              <Button disabled={issues.length > 0} onClick={() => setConfirm('publish')}>{t('forms.publish')}</Button>
            </Card>
          )}

          <FormPreview criteria={version.criteria} weighted={version.is_weighted} />
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={t('forms.delete_title')}
        message={toDelete ? t('forms.delete_text', { name: toDelete.name }) : ''}
        confirmLabel={t('common.delete')}
        danger
        loading={removeCriterion.isPending}
        onConfirm={() => toDelete && removeCriterion.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      />

      <ConfirmDialog
        open={confirm === 'publish'}
        title={t('forms.publish_title', { n: version?.version_number ?? '' })}
        message={t('forms.publish_text')}
        confirmLabel={t('forms.publish')}
        loading={publish.isPending}
        onConfirm={() => publish.mutate()}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === 'new_version'}
        title={t('forms.new_version_title')}
        message={t('forms.new_version_text', { n: newest?.version_number ?? '' })}
        confirmLabel={t('forms.new_version')}
        loading={newVersion.isPending}
        onConfirm={() => newVersion.mutate()}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === 'status'}
        title={form.status === 'active' ? t('forms.deactivate_title') : t('forms.activate_title')}
        message={form.status === 'active' ? t('forms.deactivate_text') : t('forms.activate_text')}
        confirmLabel={form.status === 'active' ? t('forms.deactivate') : t('forms.activate')}
        danger={form.status === 'active'}
        loading={changeStatus.isPending}
        onConfirm={() => changeStatus.mutate(nextStatus)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}