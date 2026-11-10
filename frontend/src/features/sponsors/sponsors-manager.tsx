'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, PencilSimple, Trash } from '@phosphor-icons/react'
import { createSponsor, deleteSponsor, reorderSponsors, updateSponsor, type SponsorInput } from './api'
import { useSponsors } from './hooks'
import { SponsorForm } from './sponsor-form'
import { eventKeys } from '@/features/events/hooks'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage } from '@/lib/api'
import type { Sponsor, SponsorTier } from '@/types'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

const TIERS: SponsorTier[] = ['diamond', 'gold', 'silver', 'supporter']
const iconBtn = 'rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40'

export function SponsorsManager({ eventId, onChanged }: { eventId: number; onChanged: () => void }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const { data: sponsors, isLoading, isError, error, refetch } = useSponsors(eventId)

  const [editing, setEditing] = useState<Sponsor | null>(null)
  const [toDelete, setToDelete] = useState<Sponsor | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const refresh = () => { queryClient.invalidateQueries({ queryKey: eventKeys.all }); onChanged() }
  const fail = (e: unknown) => setFeedback(getErrorMessage(e))

  const save = useMutation({
    mutationFn: (input: SponsorInput) => (editing ? updateSponsor(eventId, editing.id, input) : createSponsor(eventId, input)),
    onSuccess: () => { setEditing(null); setFeedback(null); refresh() },
  })
  const remove = useMutation({
    mutationFn: (s: Sponsor) => deleteSponsor(eventId, s.id),
    onSuccess: () => { setFeedback(null); refresh() },
    onError: fail,
    onSettled: () => setToDelete(null),
  })
  const reorder = useMutation({
    mutationFn: (ids: number[]) => reorderSponsors(eventId, ids),
    onSuccess: () => { setFeedback(null); refresh() },
    onError: fail,
  })

  function move(item: Sponsor, delta: number) {
    if (!sponsors) return
    const sameTier = sponsors.filter((s) => s.tier === item.tier)
    const other = sameTier[sameTier.findIndex((s) => s.id === item.id) + delta]
    if (!other) return
    const ids = sponsors.map((s) => s.id)
    const a = ids.indexOf(item.id)
    const b = ids.indexOf(other.id)
    ;[ids[a], ids[b]] = [ids[b], ids[a]]
    reorder.mutate(ids)
  }

  return (
    <div className="space-y-6">
      {feedback && <Alert kind="error">{feedback}</Alert>}

      <Card title={editing ? t('sponsors.edit') : t('sponsors.add')}>
        <SponsorForm key={editing?.id ?? 'new'} initial={editing ?? undefined} onSubmit={(input) => save.mutateAsync(input)} onCancel={editing ? () => setEditing(null) : undefined} />
      </Card>

      <Card title={t('sponsors.title')} description={t('sponsors.hint')}>
        {isLoading ? (
          <InlineSpinner />
        ) : isError || !sponsors ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : sponsors.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{t('sponsors.none')}</p>
        ) : (
          <div className={`space-y-6 ${reorder.isPending ? 'opacity-70' : ''}`}>
            {TIERS.map((tier) => {
              const items = sponsors.filter((s) => s.tier === tier)
              if (items.length === 0) return null
              return (
                <section key={tier}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">{t(`sponsor.tier_${tier}`)}</h3>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {items.map((s, i) => (
                      <li key={s.id} className="flex items-center gap-4 p-3">
                        <div className="flex h-14 w-28 shrink-0 items-center justify-center rounded-md border border-slate-100 bg-[#ffffff] p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.logo_url} alt={s.name} className="max-h-full max-w-full object-contain" />
                        </div>
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{s.name}</p>
                        <div className="flex gap-1">
                          <button className={iconBtn} aria-label={t('participants.move_up')} disabled={i === 0 || reorder.isPending} onClick={() => move(s, -1)}><ArrowUp className="h-4 w-4" /></button>
                          <button className={iconBtn} aria-label={t('participants.move_down')} disabled={i === items.length - 1 || reorder.isPending} onClick={() => move(s, 1)}><ArrowDown className="h-4 w-4" /></button>
                          <button className={iconBtn} aria-label={t('common.edit')} onClick={() => setEditing(s)}><PencilSimple className="h-4 w-4" /></button>
                          <button className={iconBtn} aria-label={t('common.delete')} onClick={() => setToDelete(s)}><Trash className="h-4 w-4" /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={toDelete !== null}
        title={t('sponsors.delete_title')}
        message={toDelete ? t('sponsors.delete_text', { name: toDelete.name }) : ''}
        confirmLabel={t('common.delete')}
        danger
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}