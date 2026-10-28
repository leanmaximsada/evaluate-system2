import { api } from '@/lib/api'
import type { SettingsData, SystemInfo } from '@/types'

export async function getSettings(): Promise<{ data: SettingsData; system: SystemInfo }> {
  return (await api.get('/settings')).data
}

export async function updateSettings(payload: SettingsData): Promise<SettingsData> {
  return (await api.put<{ data: SettingsData }>('/settings', payload)).data.data
}