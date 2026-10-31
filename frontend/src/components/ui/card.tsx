import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function Card({ title, description, action, children, className = '' }: CardProps) {
  const hasHeader = !!(title || action)

  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {hasHeader && (
        <header className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            {title && <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>}
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={hasHeader ? 'px-6 pb-6 pt-5' : 'p-6'}>{children}</div>
    </section>
  )
}