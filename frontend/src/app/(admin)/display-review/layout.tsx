'use client'

import type { ReactNode } from 'react'
import { RequirePermission } from '@/components/auth/require-permission'

export default function DisplayReviewLayout({ children }: { children: ReactNode }) {
  return <RequirePermission permission="events.manage">{children}</RequirePermission>
}