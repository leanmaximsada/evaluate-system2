import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getEvent, listEventJudges, listEvents, listJudgeCandidates, listParticipants, type EventFilters } from './api'

export const eventKeys = {
  all: ['events'] as const,
  list: (f: EventFilters) => ['events', 'list', f] as const,
  detail: (id: number) => ['events', 'detail', id] as const,
  participants: (id: number) => ['events', 'participants', id] as const,
  judges: (id: number) => ['events', 'judges', id] as const,
  candidates: (id: number, search: string) => ['events', 'candidates', id, search] as const,
}

export const useEvents = (filters: EventFilters) =>
  useQuery({ queryKey: eventKeys.list(filters), queryFn: () => listEvents(filters), placeholderData: keepPreviousData })

export const useEvent = (id: number) =>
  useQuery({ queryKey: eventKeys.detail(id), queryFn: () => getEvent(id), enabled: Number.isFinite(id) })

export const useParticipants = (id: number) =>
  useQuery({ queryKey: eventKeys.participants(id), queryFn: () => listParticipants(id), enabled: Number.isFinite(id) })

export const useEventJudges = (id: number) =>
  useQuery({ queryKey: eventKeys.judges(id), queryFn: () => listEventJudges(id), enabled: Number.isFinite(id) })

export const useJudgeCandidates = (id: number, search: string, enabled: boolean) =>
  useQuery({ queryKey: eventKeys.candidates(id, search), queryFn: () => listJudgeCandidates(id, search), enabled: enabled && Number.isFinite(id) })