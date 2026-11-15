import { api } from '@/lib/api'
import type { RevealAction, RevealState } from '@/types'

export async function getRevealState(eventId: number): Promise<RevealState> {
  return (await api.get<{ data: RevealState }>(`/events/${eventId}/reveal`)).data.data
}

export async function sendRevealAction(eventId: number, action: RevealAction): Promise<RevealState> {
  return (await api.post<{ data: RevealState }>(`/events/${eventId}/reveal`, { action })).data.data
}