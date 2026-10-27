'use client'

import type { ReactNode } from 'react'
import { RequirePermission } from '@/components/auth/require-permission'

export default function UsersLayout({ children }: { children: ReactNode }) {
  return <RequirePermission permission="users.manage">{children}</RequirePermission>
}