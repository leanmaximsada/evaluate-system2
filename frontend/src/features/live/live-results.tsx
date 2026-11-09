'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowsOut, Medal, Trophy } from '@phosphor-icons/react'
import { api } from '@/lib/api'
import { useI18n } from '@/i18n/provider'
import { ordinal } from '@/i18n/ordinal'
import type { EventStatus, PublicSponsor, PublicVisibility } from '@/types'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { LiveIndicator } from './live-indicator'
import { SponsorStrip } from './sponsor-strip'
import { useRealtimeSignal, type ConnectionState } from './use-realtime'

export interface PublicRow {
  number: string
  name: string
  team_name: string | null
  rank: number
  tied: boolean
  score?: string
}

export interface PublicResults {
  event: { name: string; code: string; status: EventStatus; subtitle: string | null }
  is_final: boolean
  visibility: PublicVisibility
  show_tie_indicator: boolean
  revision: number | null
  published_at: string | null
  organization?: { name: string | null; logo_url: string | null } | null
  sponsors?: PublicSponsor[]
  rows: PublicRow[]
}

/** Returns null when the event has no published results (a normal state, not an error). */
async function fetchPublicResults(code: string): Promise<PublicResults | null> {
  const res = await api.get<{ data: PublicResults }>(`/public/events/${encodeURIComponent(code)}/results`, {
    validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
  })
  return res.status === 404 ? null : res.data.data
}

/** Administrators only: the screen as it would look right now, built from current results. */
async function fetchPreview(eventId: number): Promise<PublicResults> {
  return (await api.get<{ data: PublicResults }>(`/events/${eventId}/results/preview`)).data.data
}

const PODIUM: Record<number, { row: string; medal: string }> = {
  1: { row: 'bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-300', medal: 'text-amber-600' },
  2: { row: 'bg-gradient-to-r from-slate-100 via-slate-200 to-slate-300', medal: 'text-slate-500' },
  3: { row: 'bg-gradient-to-r from-orange-100 via-orange-200 to-amber-300', medal: 'text-orange-700' },
}

export function LiveResults({ code, preview }: { code: string; preview?: { eventId: number } }) {
  const { t, locale, formatDateTime } = useI18n()
  const [connection, setConnection] = useState<ConnectionState>('connecting')

  const query = useQuery({
    queryKey: preview ? ['public-preview', preview.eventId] : ['public-results', code],
    queryFn: () => (preview ? fetchPreview(preview.eventId) : fetchPublicResults(code)),
    retry: false,
    // The safety net: poll quickly when live updates are not working, slowly when they are.
    refetchInterval: preview ? 10_000 : connection === 'connected' ? 120_000 : 15_000,
    refetchIntervalInBackground: true,
  })

  useRealtimeSignal(`public-results.${code.toUpperCase()}`, 'results.changed', false, () => { void query.refetch() }, setConnection)

  const unpublished = query.data === null
  const data = query.data ?? undefined
  const subtitleLines = (data?.event.subtitle ?? '').split('\n').map((line) => line.trim()).filter(Boolean)
  const organization = data?.organization

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 px-6 py-8 text-white sm:px-10 lg:px-16">
      {preview && (
        <div role="status" className="mb-6 rounded-lg bg-amber-300 px-4 py-2 text-center text-sm font-semibold text-slate-950">
          {t('live.preview_banner')}
        </div>
      )}

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {organization && (organization.logo_url || organization.name) && (
            <div className="mb-3 flex items-center gap-3">
              {organization.logo_url && (
                <span className="rounded-lg bg-white p-2 shadow">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={organization.logo_url}
                    alt={organization.name ?? t('display.org_logo')}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                    className="h-[clamp(36px,6vh,72px)] w-auto max-w-[40vw] object-contain"
                  />
                </span>
              )}
              {organization.name && <span className="text-[clamp(1rem,2vw,1.75rem)] font-semibold text-white/90">{organization.name}</span>}
            </div>
          )}
          <div className="flex items-center gap-2 text-amber-300">
            <Trophy weight="fill" className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-semibold uppercase tracking-widest">{t('live.leaderboard')}</span>
          </div>
          {data && !unpublished && (
            <>
              <h1 className="mt-2 text-[clamp(2rem,5vw,4.5rem)] font-semibold leading-tight tracking-tight">{data.event.name}</h1>
              {subtitleLines.length > 0 && (
                <div className="mt-1 space-y-0.5 text-[clamp(1rem,2vw,1.75rem)] text-white/80">
                  {subtitleLines.map((line) => <p key={line}>{line}</p>)}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-amber-300 px-3 py-1 font-semibold text-slate-950">
                  {data.is_final ? t('live.final') : t('live.provisional')}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-white">{t(`event.status_${data.event.status}`)}</span>
                {data.published_at && <span className="text-white/60">{t('live.updated', { date: formatDateTime(data.published_at) })}</span>}
                <span className="text-white/40">{t('live.checked', { time: formatDateTime(new Date(query.dataUpdatedAt)) })}</span>
              </div>
            </>
          )}
        </div>
        {!preview && (
          <div className="flex items-center gap-3">
            <LiveIndicator state={connection} dark />
            <LanguageSwitcher />
            <button
              type="button"
              aria-label={t('live.fullscreen')}
              title={t('live.fullscreen')}
              onClick={() => void document.documentElement.requestFullscreen?.()}
              className="rounded-md border border-white/30 p-2 text-white hover:bg-white/10"
            >
              <ArrowsOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </header>

      {unpublished ? (
        <div className="mx-auto mt-24 max-w-xl text-center">
          <p className="text-3xl font-semibold">{t('live.not_published')}</p>
          <p className="mt-3 text-white/70">{t('live.not_published_text')}</p>
        </div>
      ) : !data ? (
        <p className="mt-24 text-center text-xl text-white/80" role="status">
          {query.isError ? t('live.error') : t('live.loading')}
        </p>
      ) : (
        <>
          <SponsorStrip sponsors={data.sponsors ?? []} />

          {query.isError && <p className="mb-4 rounded-lg bg-amber-300/15 px-4 py-3 text-amber-100" role="status">{t('live.stale')}</p>}

          {data.rows.length === 0 ? (
            <p className="mt-16 text-center text-xl text-white/80">{t('live.no_rows')}</p>
          ) : (
            <ol className="space-y-3" aria-live="polite">
              {data.rows.map((row) => {
                const podium = PODIUM[row.rank]
                return (
                  <li
                    key={row.number}
                    className={`grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-3 rounded-2xl px-4 py-3 text-slate-900 shadow-lg sm:gap-5 sm:px-8 sm:py-4 ${podium ? podium.row : 'bg-white/95'}`}
                  >
                    <span className="block h-[clamp(1.75rem,3.2vw,3.25rem)] w-[clamp(1.75rem,3.2vw,3.25rem)]">
                      {podium && <Medal weight="fill" className={`h-full w-full ${podium.medal}`} aria-hidden="true" />}
                    </span>
                    <span className="min-w-[3ch] text-[clamp(1.1rem,2.2vw,2.25rem)] font-semibold text-slate-700">{ordinal(locale, row.rank)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-[clamp(1.1rem,2.4vw,2.4rem)] font-semibold">{row.name}</p>
                      <p className="truncate text-[clamp(0.85rem,1.3vw,1.3rem)] text-slate-600">
                        {row.team_name ?? ''}
                        {data.show_tie_indicator && row.tied && (
                          <span className="ml-3 rounded bg-black/10 px-2 py-0.5 text-sm font-medium text-slate-700">{t('results.tied')}</span>
                        )}
                      </p>
                    </div>
                    <span className="text-[clamp(1rem,2vw,2rem)] font-semibold tracking-wide text-slate-600">{row.number}</span>
                    {row.score !== undefined && (
                      <span className="min-w-[4ch] text-right text-[clamp(1.25rem,2.8vw,2.75rem)] font-bold tabular-nums">{row.score}</span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </>
      )}
    </main>
  )
}