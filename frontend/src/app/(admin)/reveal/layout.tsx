'use client'

import type { ReactNode } from 'react'
import { RequirePermission } from '@/components/auth/require-permission'

export default function RevealLayout({ children }: { children: ReactNode }) {
  return <RequirePermission permission="results.publish">{children}</RequirePermission>
}