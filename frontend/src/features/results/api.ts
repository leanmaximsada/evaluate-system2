import { api } from '@/lib/api'
import type { ParticipantDetail, Publication, PublicVisibility, ResultsOverview } from '@/types'

export interface PublishPayload {
  visibility: PublicVisibility
  confirm: true
  accept_incomplete?: boolean
  correction_reason?: string
}

export async function getResults(eventId: number): Promise<ResultsOverview> {
  return (await api.get<{ data: ResultsOverview }>(`/events/${eventId}/results`)).data.data
}

export async function getParticipantResult(eventId: number, participantId: number): Promise<ParticipantDetail> {
  return (await api.get<{ data: ParticipantDetail }>(`/events/${eventId}/results/${participantId}`)).data.data
}

export async function listPublications(eventId: number): Promise<Publication[]> {
  return (await api.get<{ data: Publication[] }>(`/events/${eventId}/results/publications`)).data.data
}

export async function recalculateResults(eventId: number): Promise<ResultsOverview> {
  return (await api.post<{ data: ResultsOverview }>(`/events/${eventId}/results/recalculate`)).data.data
}

export async function publishResults(eventId: number, payload: PublishPayload): Promise<Publication> {
  return (await api.post<{ data: Publication }>(`/events/${eventId}/results/publish`, payload)).data.data
}

export async function unpublishResults(eventId: number, reason: string): Promise<Publication> {
  return (await api.post<{ data: Publication }>(`/events/${eventId}/results/unpublish`, reason ? { reason } : {})).data.data
}

/** Downloads the CSV through the API (the session cookie authorises it). */
export async function downloadResultsCsv(eventId: number, eventCode: string): Promise<void> {
  const res = await api.get<Blob>(`/events/${eventId}/results/export`, { params: { format: 'csv' }, responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const link = document.createElement('a')
  link.href = url
  link.download = `results-${eventCode.replace(/[^A-Za-z0-9_-]/g, '') || 'event'}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}