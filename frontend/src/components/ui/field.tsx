'use client'

import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { useI18n } from '@/i18n/provider'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, id, className = '', ...props },
  ref,
) {
  const { tx } = useI18n()
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-900">{label}</label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={`block h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15'
            : 'border-slate-300 focus:border-slate-900 focus:ring-slate-900/10'
        } ${className}`}
        {...props}
      />
      {error && <p id={errorId} role="alert" className="text-sm text-red-600">{tx(error)}</p>}
    </div>
  )
})