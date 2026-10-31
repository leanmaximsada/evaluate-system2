'use client'

import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import { useI18n } from '@/i18n/provider'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  hint?: string
}

export const SelectField = forwardRef<HTMLSelectElement, Props>(function SelectField(
  { label, error, hint, id, className = '', children, ...props },
  ref,
) {
  const { tx } = useI18n()
  const autoId = useId()
  const selectId = id ?? autoId
  const errorId = `${selectId}-error`
  const hintId = `${selectId}-hint`

  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="block text-sm font-medium text-slate-900">{label}</label>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={`block h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15'
            : 'border-slate-300 focus:border-slate-900 focus:ring-slate-900/10'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {hint && !error && <p id={hintId} className="text-xs text-slate-500">{tx(hint)}</p>}
      {error && <p id={errorId} role="alert" className="text-sm text-red-600">{tx(error)}</p>}
    </div>
  )
})