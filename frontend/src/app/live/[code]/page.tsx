import { Suspense } from 'react'
import { LivePageClient } from './live-page-client'

export default function LiveResultsPage() {
  return (
    <Suspense fallback={null}>
      <LivePageClient />
    </Suspense>
  )
}