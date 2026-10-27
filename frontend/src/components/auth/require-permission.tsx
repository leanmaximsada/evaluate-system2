'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth/use-auth'

/** UI convenience only. Laravel still returns 403 for every protected request. */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { user, can } = useAuth()
  const router = useRouter()
  const allowed = can(permission)

  useEffect(() => {
    if (user && !allowed) router.replace('/forbidden')
  }, [user, allowed, router])

  return allowed ? <>{children}</> : null
}