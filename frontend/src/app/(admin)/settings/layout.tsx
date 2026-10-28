'use client'

import type { ReactNode } from 'react'
import { RequirePermission } from '@/components/auth/require-permission'

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <RequirePermission permission="settings.manage">{children}</RequirePermission>
}