import { api } from '@/lib/api'
import type { DashboardData } from '@/types'

export async function getDashboard(): Promise<DashboardData> {
  return (await api.get<{ data: DashboardData }>('/dashboard')).data.data
}