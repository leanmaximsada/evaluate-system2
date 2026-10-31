'use client'

import { CalendarBlank, CheckCircle, Gavel, HourglassMedium, ShieldCheck, UserCheck, Users, UsersThree } from '@phosphor-icons/react'
import { useAuth } from '@/features/auth/use-auth'
import { useDashboard } from '@/features/dashboard/hooks'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
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
          {data.users && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label={t('dashboard.users_total')} value={data.users.total} icon={Users} />
              <StatCard label={t('dashboard.users_active')} value={data.users.active} icon={UserCheck} />
              <StatCard label={t('dashboard.users_admins')} value={data.users.admins} icon={ShieldCheck} />
              <StatCard label={t('dashboard.users_judges')} value={data.users.judges} icon={Gavel} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t('dashboard.events')} value="—" hint={t('dashboard.coming')} icon={CalendarBlank} />
            <StatCard label={t('dashboard.participants')} value="—" hint={t('dashboard.coming')} icon={UsersThree} />
            <StatCard label={t('dashboard.completion')} value="—" hint={t('dashboard.coming')} icon={CheckCircle} />
            <StatCard label={t('dashboard.pending')} value="—" hint={t('dashboard.coming')} icon={HourglassMedium} />
          </div>

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
            <Card>
              <p className="text-sm text-slate-700">{t('dashboard.welcome', { name: user?.name ?? '' })}</p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}