import type { ReactNode } from 'react'

const tone = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-green-200 bg-green-50 text-green-800',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
}

export function Alert({ kind = 'info', children }: { kind?: keyof typeof tone; children: ReactNode }) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${tone[kind]}`}>
      {children}
    </div>
  )
}