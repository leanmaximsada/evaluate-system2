import { useQuery } from '@tanstack/react-query'
import { getParticipantResult, getResults, listPublications } from './api'

export const resultKeys = {
  all: ['results'] as const,
  overview: (id: number) => ['results', 'overview', id] as const,
  detail: (id: number, participantId: number) => ['results', 'detail', id, participantId] as const,
  publications: (id: number) => ['results', 'publications', id] as const,
}

export const useResults = (id: number) =>
  useQuery({ queryKey: resultKeys.overview(id), queryFn: () => getResults(id), enabled: Number.isFinite(id) })

export const useParticipantResult = (id: number, participantId: number) =>
  useQuery({
    queryKey: resultKeys.detail(id, participantId),
    queryFn: () => getParticipantResult(id, participantId),
    enabled: Number.isFinite(id) && Number.isFinite(participantId),
  })

export const usePublications = (id: number) =>
  useQuery({ queryKey: resultKeys.publications(id), queryFn: () => listPublications(id), enabled: Number.isFinite(id) })