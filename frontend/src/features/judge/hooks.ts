import { useQuery } from '@tanstack/react-query'
import { getJudgeEvent, getJudgeParticipant, listJudgeEvents } from './api'

export const judgeKeys = {
  all: ['judge'] as const,
  events: ['judge', 'events'] as const,
  event: (id: number) => ['judge', 'event', id] as const,
  participant: (id: number, participantId: number) => ['judge', 'participant', id, participantId] as const,
}

export const useJudgeEvents = () =>
  useQuery({ queryKey: judgeKeys.events, queryFn: listJudgeEvents, refetchInterval: 60_000 })

export const useJudgeEvent = (id: number) =>
  useQuery({ queryKey: judgeKeys.event(id), queryFn: () => getJudgeEvent(id), enabled: Number.isFinite(id) })

export const useJudgeParticipant = (id: number, participantId: number) =>
  useQuery({
    queryKey: judgeKeys.participant(id, participantId),
    queryFn: () => getJudgeParticipant(id, participantId),
    enabled: Number.isFinite(id) && Number.isFinite(participantId),
  })