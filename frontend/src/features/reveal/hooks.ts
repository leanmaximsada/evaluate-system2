import { useQuery } from '@tanstack/react-query'
import { getRevealState } from './api'

export const revealKey = (eventId: number) => ['events', 'reveal', eventId] as const

// Polls every few seconds, so two presenters or a second phone stay in step.
export const useRevealState = (eventId: number) =>
  useQuery({ queryKey: revealKey(eventId), queryFn: () => getRevealState(eventId), enabled: Number.isFinite(eventId), refetchInterval: 5_000 })