'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowsOut, Trophy } from '@phosphor-icons/react'
import { api, getStatus } from '@/lib/api'
import { useI18n } from '@/i18n/provider'
import type { EventStatus, PublicVisibility } from '@/types'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { LiveIndicator } from './live-indicator'
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
  event: { name: string; code: string; status: EventStatus }
  is_final: boolean
  visibility: PublicVisibility
  show_tie_indicator: boolean
  revision: number
  published_at: string | null
  rows: PublicRow[]
}

/** Returns null when the event has no published results (a normal state, not an error). */
async function fetchPublicResults(code: string): Promise<PublicResults | null> {
  try {
    return (await api.get<{ data: PublicResults }>(`/public/events/${encodeURIComponent(code)}/results`)).data.data
  } catch (error) {
    if (getStatus(error) === 404) return null
    throw error
  }
}

export function LiveResults({ code }: { code: string }) {
  const { t, formatDateTime } = useI18n()
  const [connection, setConnection] = useState<ConnectionState>('connecting')

  const query = useQuery({
    queryKey: ['public-results', code],
    queryFn: () => fetchPublicResults(code),
    retry: false,
    // The safety net: poll quickly when live updates are not working, slowly when they are.
    refetchInterval: connection === 'connected' ? 120_000 : 15_000,
    refetchIntervalInBackground: true,
  })

  useRealtimeSignal(`public-results.${code.toUpperCase()}`, 'results.changed', false, () => { void query.refetch() }, setConnection)

  const unpublished = query.data === null
  const data = query.data ?? undefined

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white sm:px-10 lg:px-16">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-slate-300">
            <Trophy weight="fill" className="h-5 w-5 text-amber-300" aria-hidden="true" />
            <span className="text-sm font-medium uppercase tracking-wider">{t('live.title_fallback')}</span>
          </div>
          {data && !unpublished && (
            <>
              <h1 className="mt-2 text-[clamp(2rem,5vw,4.5rem)] font-semibold leading-tight tracking-tight">{data.event.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-amber-300 px-3 py-1 font-semibold text-slate-950">
                  {data.is_final ? t('live.final') : t('live.provisional')}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">{t(`event.status_${data.event.status}`)}</span>
                {data.published_at && <span className="text-slate-400">{t('live.updated', { date: formatDateTime(data.published_at) })}</span>}
                <span className="text-slate-500">{t('live.checked', { time: formatDateTime(new Date(query.dataUpdatedAt)) })}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator state={connection} dark />
          <LanguageSwitcher />
          <button
            type="button"
            aria-label={t('live.fullscreen')}
            title={t('live.fullscreen')}
            onClick={() => void document.documentElement.requestFullscreen?.()}
            className="rounded-md border border-white/20 p-2 text-slate-200 hover:bg-white/10"
          >
            <ArrowsOut className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {unpublished ? (
        <div className="mx-auto mt-24 max-w-xl text-center">
          <p className="text-3xl font-semibold">{t('live.not_published')}</p>
          <p className="mt-3 text-slate-400">{t('live.not_published_text')}</p>
        </div>
      ) : !data ? (
        <p className="mt-24 text-center text-xl text-slate-300" role="status">
          {query.isError ? t('live.error') : t('live.loading')}
        </p>
      ) : (
        <>
          {query.isError && <p className="mb-4 rounded-lg bg-amber-300/10 px-4 py-3 text-amber-200" role="status">{t('live.stale')}</p>}

          {data.rows.length === 0 ? (
            <p className="mt-16 text-center text-xl text-slate-300">{t('live.no_rows')}</p>
          ) : (
            <ol className="space-y-3" aria-live="polite">
              {data.rows.map((row) => (
                <li
                  key={row.number}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 sm:gap-6 sm:px-8 sm:py-5"
                >
                  <span className="min-w-[2.5ch] text-center text-[clamp(1.75rem,4vw,3.5rem)] font-bold tabular-nums text-amber-300">{row.rank}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[clamp(1.25rem,2.6vw,2.5rem)] font-medium">{row.name}</p>
                    <p className="truncate text-[clamp(0.9rem,1.4vw,1.4rem)] text-slate-400">
                      #{row.number}
                      {row.team_name ? ` · ${row.team_name}` : ''}
                      {data.show_tie_indicator && row.tied && (
                        <span className="ml-3 rounded bg-white/10 px-2 py-0.5 text-sm text-slate-200">{t('results.tied')}</span>
                      )}
                    </p>
                  </div>
                  {row.score !== undefined && (
                    <span className="text-[clamp(1.5rem,3.5vw,3rem)] font-semibold tabular-nums">{row.score}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </main>
  )
}