'use client'

import type { ReactNode } from 'react'
import { RequirePermission } from '@/components/auth/require-permission'

export default function FormsLayout({ children }: { children: ReactNode }) {
  return <RequirePermission permission="forms.manage">{children}</RequirePermission>
}