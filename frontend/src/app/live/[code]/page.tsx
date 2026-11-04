'use client'

import { useParams } from 'next/navigation'
import { LiveResults } from '@/features/live/live-results'

export default function LiveResultsPage() {
  const params = useParams<{ code: string }>()
  return <LiveResults code={decodeURIComponent(params.code)} />
}