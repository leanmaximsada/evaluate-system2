'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { ArrowLeft } from '@phosphor-icons/react'
import { useEvent } from '@/features/events/hooks'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage, getStatus } from '@/lib/api'
import { EventStatusBadge } from '@/components/ui/event-status-badge'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

export default function EventLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const pathname = usePathname()
  const { data: event, isLoading, isError, error, refetch } = useEvent(id)

  if (isLoading) return <InlineSpinner />
  if (isError || !event) {
    return getStatus(error) === 404
      ? <ErrorState message={t('events.not_found')} />
      : <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
  }

  const base = `/events/${id}`
  const tabs = [
    { href: base, key: 'events.tab_overview' as const },
    { href: `${base}/participants`, key: 'events.tab_participants' as const },
    { href: `${base}/judges`, key: 'events.tab_judges' as const },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />{t('events.title')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{event.name}</h1>
          <EventStatusBadge status={event.status} />
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{event.code}</span>
        </div>
      </div>

      <nav aria-label={event.name} className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {t(tab.key)}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}