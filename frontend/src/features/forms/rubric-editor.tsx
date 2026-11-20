'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash } from '@phosphor-icons/react'
import type { Criterion, RubricColor, RubricLevel } from '@/types'
import { useI18n } from '@/i18n/provider'
import type { MessageKey } from '@/i18n/messages/en'
import { getErrorMessage, getErrorMessages } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { SelectField } from '@/components/ui/select-field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'
import { BandLabel, LevelBadge } from './level-badge'
import { MAX_LEVELS, RUBRIC_COLORS, RUBRIC_PRESET, sortLevels, validateRubric } from './rubric'
import { saveRubric, type RubricLevelInput } from './rubric-api'
import { rubricKey, useRubric } from './rubric-hooks'

interface DraftLevel extends RubricLevel {
  uid: string
}

let counter = 0
const nextUid = () => `level-${++counter}`
const toDraft = (levels: RubricLevel[]): DraftLevel[] => levels.map((l) => ({ ...l, descriptions: { ...l.descriptions }, uid: nextUid() }))
const textarea = 'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10'

interface Props {
  formId: number
  versionId: number
  /** Active criteria of this version. */
  criteria: Criterion[]
  editable: boolean
}

export function RubricEditor({ formId, versionId, criteria, editable }: Props) {
  const { t } = useI18n()
  const query = useRubric(formId, versionId)

  return (
    <Card title={t('rubric.title')} description={t('rubric.hint')}>
      {query.isLoading ? (
        <InlineSpinner />
      ) : query.isError || !query.data ? (
        <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : (
        <RubricForm key={versionId} formId={formId} versionId={versionId} initial={query.data.levels} criteria={criteria} editable={editable} />
      )}
    </Card>
  )
}

function RubricForm({ formId, versionId, initial, criteria, editable }: Props & { initial: RubricLevel[] }) {
  const { t, tx } = useI18n()
  const queryClient = useQueryClient()
  const [levels, setLevels] = useState<DraftLevel[]>(() => toDraft(initial))
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: (payload: RubricLevelInput[]) => saveRubric(formId, versionId, payload),
    onSuccess: (data) => {
      setLevels(toDraft(data.levels))
      setMessages([])
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: rubricKey(formId, versionId) })
    },
    onError: (e) => setMessages(getErrorMessages(e)),
  })

  const patch = (uid: string, change: Partial<RubricLevel>) => {
    setSaved(false)
    setLevels((all) => all.map((l) => (l.uid === uid ? { ...l, ...change } : l)))
  }
  const describe = (uid: string, criterionId: number, text: string) => {
    setSaved(false)
    setLevels((all) => all.map((l) => (l.uid === uid ? { ...l, descriptions: { ...l.descriptions, [String(criterionId)]: text } } : l)))
  }

  function submit() {
    const problem = validateRubric(levels)
    setError(problem)
    setSaved(false)
    if (problem) return

    save.mutate(
      levels.map(({ uid: _uid, ...level }) => ({
        name: level.name.trim(),
        name_km: level.name_km?.trim() || null,
        min_percent: level.min_percent.trim(),
        color: level.color,
        descriptions: Object.fromEntries(
          Object.entries(level.descriptions)
            .map(([id, text]) => [id, text.trim()] as const)
            .filter(([, text]) => text !== ''),
        ),
      })),
    )
  }

  if (!editable) {
    const sorted = sortLevels(levels)
    if (sorted.length === 0) return <p className="py-4 text-center text-sm text-slate-500">{t('rubric.none_published')}</p>

    return (
      <div className="space-y-4">
        <Alert kind="info">{t('rubric.published_note')}</Alert>
        <ul className="space-y-3">
          {sorted.map((level) => (
            <li key={level.uid} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <LevelBadge level={level} />
                <span className="text-sm text-slate-500"><BandLabel levels={sorted} level={level} /></span>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {criteria.filter((c) => level.descriptions[String(c.id)]).map((c) => (
                  <li key={c.id}><span className="font-medium">{c.name}:</span> {level.descriptions[String(c.id)]}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {saved && <Alert kind="success">{t('rubric.saved')}</Alert>}
      {error && <Alert kind="error">{tx(error)}</Alert>}
      {messages.map((m) => <Alert key={m} kind="error">{m}</Alert>)}

      {levels.length === 0 && <p className="text-sm text-slate-500">{t('rubric.none')}</p>}

      <ul className="space-y-4">
        {levels.map((level) => (
          <li key={level.uid} className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <LevelBadge level={{ name: level.name || t('rubric.level_unnamed'), name_km: level.name_km, color: level.color }} />
              <Button variant="secondary" onClick={() => { setSaved(false); setLevels((all) => all.filter((l) => l.uid !== level.uid)) }}>
                <Trash className="h-4 w-4" aria-hidden="true" />{t('rubric.remove_level')}
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('rubric.level_name')} autoComplete="off" value={level.name} onChange={(e) => patch(level.uid, { name: e.target.value })} />
              <Field label={t('rubric.level_name_km')} autoComplete="off" value={level.name_km ?? ''} onChange={(e) => patch(level.uid, { name_km: e.target.value })} />
              <Field label={t('rubric.min_percent')} type="number" min={0} max={100} step="0.01" value={level.min_percent} onChange={(e) => patch(level.uid, { min_percent: e.target.value })} />
              <SelectField label={t('rubric.color')} value={level.color} onChange={(e) => patch(level.uid, { color: e.target.value as RubricColor })}>
                {RUBRIC_COLORS.map((c) => <option key={c} value={c}>{t(`rubric.color_${c}` as MessageKey)}</option>)}
              </SelectField>
            </div>

            <details>
              <summary className="cursor-pointer text-sm font-medium text-slate-900">{t('rubric.descriptions')}</summary>
              <div className="mt-3 space-y-3">
                {criteria.length === 0 && <p className="text-sm text-slate-500">{t('rubric.no_criteria')}</p>}
                {criteria.map((c) => (
                  <div key={c.id} className="space-y-1.5">
                    <label htmlFor={`d-${level.uid}-${c.id}`} className="block text-sm font-medium text-slate-900">{c.name}</label>
                    <textarea
                      id={`d-${level.uid}-${c.id}`}
                      rows={2}
                      maxLength={500}
                      value={level.descriptions[String(c.id)] ?? ''}
                      onChange={(e) => describe(level.uid, c.id, e.target.value)}
                      className={textarea}
                    />
                  </div>
                ))}
              </div>
            </details>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        {levels.length === 0 && (
          <Button variant="secondary" onClick={() => { setSaved(false); setLevels(toDraft(RUBRIC_PRESET.map((l) => ({ ...l, descriptions: {} })))) }}>
            {t('rubric.use_default')}
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={levels.length >= MAX_LEVELS}
          onClick={() => { setSaved(false); setLevels((all) => [...all, { uid: nextUid(), name: '', name_km: null, min_percent: '', color: 'slate', descriptions: {} }]) }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />{t('rubric.add_level')}
        </Button>
        {levels.length > 0 && <Button variant="secondary" onClick={() => { setSaved(false); setLevels([]) }}>{t('rubric.clear')}</Button>}
        <Button onClick={submit} loading={save.isPending}>{t('rubric.save')}</Button>
      </div>
    </div>
  )
}