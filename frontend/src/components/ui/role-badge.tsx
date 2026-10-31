'use client'

import type { Role } from '@/types'
import { useI18n } from '@/i18n/provider'

const tone: Record<Role, string> = {
  super_admin: 'bg-purple-50 text-purple-700 ring-purple-200',
  admin: 'bg-blue-50 text-blue-700 ring-blue-200',
  judge: 'bg-amber-50 text-amber-700 ring-amber-200',
}

export function RoleBadge({ role }: { role: Role }) {
  const { t } = useI18n()
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone[role]}`}>
      {t(`role.${role}`)}
    </span>
  )
}