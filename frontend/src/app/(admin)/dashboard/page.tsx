'use client'

import Link from 'next/link'
import { CalendarBlank, CheckCircle, Gavel, HourglassMedium, Lightning, Clock, ShieldCheck, UserCheck, Users, UsersThree } from '@phosphor-icons/react'
import { useAuth } from '@/features/auth/use-auth'
import { useDashboard } from '@/features/dashboard/hooks'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { EventStatusBadge } from '@/components/ui/event-status-badge'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

export default function DashboardPage() {
  const { user } = useAuth()
  const { t, formatDateTime } = useI18n()
  const { data, isLoading, isError, error, refetch } = useDashboard()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{t('dashboard.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('dashboard.subtitle')}</p>
      </div>

      {isLoading ? (
        <InlineSpinner />
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : (
        <>
          {data.events && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label={t('dashboard.events_total')} value={data.events.total} icon={CalendarBlank} />
                <StatCard label={t('dashboard.events_active')} value={data.events.by_status.in_progress} icon={Lightning} />
                <StatCard label={t('dashboard.events_upcoming')} value={data.events.by_status.upcoming} hint={t('dashboard.hint_draft', { n: data.events.by_status.draft })} icon={Clock} />
                <StatCard label={t('dashboard.events_completed')} value={data.events.by_status.completed} icon={CheckCircle} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label={t('dashboard.participants')} value={data.events.participants} icon={UsersThree} />
                <StatCard label={t('dashboard.judges_assigned')} value={data.events.judges} icon={Gavel} />
                                <StatCard
                  label={t('dashboard.completion')}
                  value={data.events.evaluations.expected > 0 ? `${Math.round((data.events.evaluations.submitted / data.events.evaluations.expected) * 1000) / 10}%` : '—'}
                  hint={t('dashboard.completion_hint', { done: data.events.evaluations.submitted, total: data.events.evaluations.expected })}
                  icon={CheckCircle}
                />
                <StatCard
                  label={t('dashboard.pending')}
                  value={data.events.evaluations.expected > 0 ? data.events.evaluations.expected - data.events.evaluations.submitted : '—'}
                  hint={t('dashboard.pending_hint')}
                  icon={HourglassMedium}
                />
              </div>
            </>
          )}

          {data.users && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label={t('dashboard.users_total')} value={data.users.total} icon={Users} />
              <StatCard label={t('dashboard.users_active')} value={data.users.active} icon={UserCheck} />
              <StatCard label={t('dashboard.users_admins')} value={data.users.admins} icon={ShieldCheck} />
              <StatCard label={t('dashboard.users_judges')} value={data.users.judges} icon={Gavel} />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {data.events && (
              <Card title={t('dashboard.recent_events')} description={t('dashboard.recent_events_sub')}>
                {data.events.recent.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">{t('dashboard.no_events')}</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.events.recent.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div>
                          <Link href={`/events/${e.id}`} className="text-sm font-medium text-slate-900 hover:underline">{e.name}</Link>
                          <p className="text-sm text-slate-500">{formatDateTime(e.updated_at)}</p>
                        </div>
                        <EventStatusBadge status={e.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

            {data.activity ? (
              <Card title={t('dashboard.activity')} description={t('dashboard.activity_sub')}>
                {data.activity.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">{t('dashboard.no_activity')}</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.activity.map((item) => (
                      <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                        <p className="text-sm font-medium text-slate-900">{item.action}</p>
                        <p className="text-sm text-slate-500">{item.actor ?? t('common.system')} · {formatDateTime(item.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ) : (
              !data.events && (
                <Card><p className="text-sm text-slate-700">{t('dashboard.welcome', { name: user?.name ?? '' })}</p></Card>
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}