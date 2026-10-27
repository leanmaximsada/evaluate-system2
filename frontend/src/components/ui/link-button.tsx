import Link from 'next/link'
import type { ReactNode } from 'react'

const styles = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
}

export function LinkButton({ href, children, variant = 'primary' }: { href: string; children: ReactNode; variant?: keyof typeof styles }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${styles[variant]}`}
    >
      {children}
    </Link>
  )
}