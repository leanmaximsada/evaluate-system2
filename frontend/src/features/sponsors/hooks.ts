import { useQuery } from '@tanstack/react-query'
import { listSponsors } from './api'

export const sponsorKey = (eventId: number) => ['events', 'sponsors', eventId] as const

export const useSponsors = (eventId: number) =>
  useQuery({ queryKey: sponsorKey(eventId), queryFn: () => listSponsors(eventId), enabled: Number.isFinite(eventId) })