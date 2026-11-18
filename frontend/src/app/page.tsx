import type { Metadata } from 'next'
import { LandingPage } from '@/features/landing/landing-page'

export const metadata: Metadata = {
  title: 'Evaluation System',
  description: 'Run judged events with fair, transparent results. Khmer and English.',
}

export default function HomePage() {
  return <LandingPage />
}