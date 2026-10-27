import type { Role } from '@/types'

const label: Record<Role, string> = { super_admin: 'Super Admin', admin: 'Admin', judge: 'Judge' }
const tone: Record<Role, string> = {
  super_admin: 'bg-purple-100 text-purple-800',
  admin: 'bg-indigo-100 text-indigo-800',
  judge: 'bg-slate-100 text-slate-700',
}

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone[role]}`}>{label[role]}</span>
}