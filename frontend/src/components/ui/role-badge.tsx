'use client'

import type { Role } from '@/types'
import { useI18n } from '@/i18n/provider'

const tone: Record<Role, string> = {
  super_admin: 'bg-purple-100 text-purple-800',
  admin: 'bg-indigo-100 text-indigo-800',
  judge: 'bg-slate-100 text-slate-700',
}

export function RoleBadge({ role }: { role: Role }) {
  const { t } = useI18n()
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone[role]}`}>{t(`role.${role}`)}</span>
}