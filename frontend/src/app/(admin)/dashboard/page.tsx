'use client'

import { useAuth } from '@/features/auth/use-auth'
import { Card } from '@/components/ui/card'

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Card>
        <p className="text-slate-700">Welcome back, {user?.name}. Dashboard statistics arrive in a later step.</p>
      </Card>
    </div>
  )
}