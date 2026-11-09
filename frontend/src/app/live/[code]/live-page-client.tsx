'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { LiveResults } from '@/features/live/live-results'

export function LivePageClient() {
  const params = useParams<{ code: string }>()
  const search = useSearchParams()

  const eventId = Number(search.get('event') ?? '')
  const preview = search.get('preview') === '1' && Number.isInteger(eventId) && eventId > 0 ? { eventId } : undefined

  return <LiveResults code={decodeURIComponent(params.code)} preview={preview} />
}