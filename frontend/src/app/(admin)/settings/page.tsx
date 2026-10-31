'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateSettings } from '@/features/settings/api'
import { settingsKey, useSettings } from '@/features/settings/hooks'
import { SettingsForm } from '@/features/settings/settings-form'
import { useI18n } from '@/i18n/provider'
import type { MessageKey } from '@/i18n/messages/en'
import { getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

const OUTSIDE: MessageKey[] = [
  'settings.outside_1', 'settings.outside_2', 'settings.outside_3', 'settings.outside_4',
  'settings.outside_5', 'settings.outside_6', 'settings.outside_7',
]

export default function SettingsPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useSettings()

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsKey, (old: typeof data) => (old ? { ...old, data: settings } : old))
    },
  })

  if (isLoading) return <InlineSpinner />
  if (isError || !data) return <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />

  const info = data.system
  const rows: [MessageKey, string][] = [
    ['settings.info_env', info.environment],
    ['settings.info_debug', info.debug ? t('common.on') : t('common.off')],
    ['settings.info_php', info.php_version],
    ['settings.info_laravel', info.laravel_version],
    ['settings.info_database', info.database_driver],
    ['settings.info_queue', info.queue_driver],
    ['settings.info_broadcast', info.broadcast_driver],
    ['settings.info_timezone', info.timezone],
  ]

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>

      <SettingsForm initial={data.data} onSubmit={(values) => mutation.mutateAsync(values)} />

      <Card title={t('settings.system_info')}>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {rows.map(([labelKey, value]) => (
            <div key={labelKey}>
              <dt className="text-slate-500">{t(labelKey)}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {info.environment === 'production' && info.debug && (
          <p className="mt-4 text-sm text-red-700">{t('settings.debug_warning')}</p>
        )}
      </Card>

      <Card title={t('settings.outside_title')}>
        <p className="mb-3 text-sm text-slate-600">{t('settings.outside_text')}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {OUTSIDE.map((key) => <li key={key}>{t(key)}</li>)}
        </ul>
      </Card>
    </div>
  )
}