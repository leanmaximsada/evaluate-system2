import { useQuery } from '@tanstack/react-query'
import { getSettings } from './api'

export const settingsKey = ['settings'] as const

export function useSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: getSettings })
}