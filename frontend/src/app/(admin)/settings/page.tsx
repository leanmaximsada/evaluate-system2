'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateSettings } from '@/features/settings/api'
import { settingsKey, useSettings } from '@/features/settings/hooks'
import { SettingsForm } from '@/features/settings/settings-form'
import { getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

const DEPLOYMENT_ONLY = [
  'Database connection and credentials',
  'Application key and encryption',
  'Mail server (used for password reset emails)',
  'Real-time server (Reverb) keys and host',
  'Queue driver and workers',
  'Session lifetime, cookie domain and allowed frontend origins',
  'File storage location',
]

export default function SettingsPage() {
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

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <SettingsForm initial={data.data} onSubmit={(values) => mutation.mutateAsync(values)} />

      <Card title="System information">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ['Environment', info.environment],
            ['Debug mode', info.debug ? 'On' : 'Off'],
            ['PHP', info.php_version],
            ['Laravel', info.laravel_version],
            ['Database', info.database_driver],
            ['Queue', info.queue_driver],
            ['Broadcasting', info.broadcast_driver],
            ['Server timezone', info.timezone],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {info.environment === 'production' && info.debug && (
          <p className="mt-4 text-sm text-red-700">Debug mode is on in production. Turn it off in the server environment.</p>
        )}
      </Card>

      <Card title="Configured outside this page">
        <p className="mb-3 text-sm text-slate-600">
          For security, these can only be changed in the server environment (the <code>.env</code> file or your host&apos;s settings):
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {DEPLOYMENT_ONLY.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </Card>
    </div>
  )
}