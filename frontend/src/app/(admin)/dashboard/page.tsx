'use client'

import { useAuth } from '@/features/auth/use-auth'
import { useI18n } from '@/i18n/provider'
import { Card } from '@/components/ui/card'

export default function DashboardPage() {
  const { user } = useAuth()
  const { t } = useI18n()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1>
      <Card>
        <p className="text-slate-700">{t('dashboard.welcome', { name: user?.name ?? '' })}</p>
      </Card>
    </div>
  )
}