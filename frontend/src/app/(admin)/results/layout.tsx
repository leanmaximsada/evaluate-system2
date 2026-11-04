'use client'

import type { ReactNode } from 'react'
import { RequirePermission } from '@/components/auth/require-permission'

export default function ResultsLayout({ children }: { children: ReactNode }) {
  return <RequirePermission permission="results.view">{children}</RequirePermission>
}