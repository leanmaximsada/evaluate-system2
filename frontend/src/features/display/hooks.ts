import { useQuery } from '@tanstack/react-query'
import { getDisplayPreview } from './api'

// The key starts with "events", so invalidating the events cache also refreshes the checklist.
export const useDisplayPreview = (eventId: number) =>
  useQuery({ queryKey: ['events', 'display-preview', eventId], queryFn: () => getDisplayPreview(eventId), enabled: Number.isFinite(eventId) })