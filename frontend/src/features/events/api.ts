import { api } from '@/lib/api'
import type { EventItem, EventStatus, Judge, Paginated, Participant, ParticipantStatus } from '@/types'

export interface EventFilters {
  search?: string
  status?: EventStatus | ''
  page?: number
  per_page?: number
}

export interface EventPayload {
  name: string
  code: string
  description?: string
  venue?: string
  category?: string
  timezone: string
  starts_at: string
  ends_at: string
}

export interface ParticipantPayload {
  name: string
  number: string
  team_name?: string
  status?: ParticipantStatus
}

const clean = (params: object) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined))

export async function listEvents(filters: EventFilters): Promise<Paginated<EventItem>> {
  return (await api.get<Paginated<EventItem>>('/events', { params: clean(filters) })).data
}

export async function getEvent(id: number): Promise<EventItem> {
  return (await api.get<{ data: EventItem }>(`/events/${id}`)).data.data
}

export async function createEvent(payload: EventPayload): Promise<EventItem> {
  return (await api.post<{ data: EventItem }>('/events', payload)).data.data
}

export async function updateEvent(id: number, payload: EventPayload): Promise<EventItem> {
  return (await api.put<{ data: EventItem }>(`/events/${id}`, payload)).data.data
}

export async function changeEventStatus(id: number, status: EventStatus): Promise<EventItem> {
  return (await api.patch<{ data: EventItem }>(`/events/${id}/status`, { status })).data.data
}

export async function listParticipants(eventId: number): Promise<Participant[]> {
  return (await api.get<{ data: Participant[] }>(`/events/${eventId}/participants`)).data.data
}

export async function createParticipant(eventId: number, payload: ParticipantPayload): Promise<Participant> {
  return (await api.post<{ data: Participant }>(`/events/${eventId}/participants`, payload)).data.data
}

export async function updateParticipant(eventId: number, id: number, payload: ParticipantPayload): Promise<Participant> {
  return (await api.put<{ data: Participant }>(`/events/${eventId}/participants/${id}`, payload)).data.data
}

export const deleteParticipant = (eventId: number, id: number) => api.delete(`/events/${eventId}/participants/${id}`)

export async function reorderParticipants(eventId: number, order: number[]): Promise<Participant[]> {
  return (await api.put<{ data: Participant[] }>(`/events/${eventId}/participants/order`, { order })).data.data
}

export async function listEventJudges(eventId: number): Promise<Judge[]> {
  return (await api.get<{ data: Judge[] }>(`/events/${eventId}/judges`)).data.data
}

export async function listJudgeCandidates(eventId: number, search: string): Promise<Judge[]> {
  return (await api.get<{ data: Judge[] }>(`/events/${eventId}/judge-candidates`, { params: clean({ search }) })).data.data
}

export async function assignJudge(eventId: number, userId: number): Promise<Judge> {
  return (await api.post<{ data: Judge }>(`/events/${eventId}/judges`, { user_id: userId })).data.data
}

export const unassignJudge = (eventId: number, userId: number) => api.delete(`/events/${eventId}/judges/${userId}`)

export async function assignEventForm(eventId: number, formId: number): Promise<EventItem> {
  return (await api.put<{ data: EventItem }>(`/events/${eventId}/form`, { form_id: formId })).data.data
} 

export async function clearEventForm(eventId: number): Promise<EventItem> {
  return (await api.delete<{ data: EventItem }>(`/events/${eventId}/form`)).data.data
}