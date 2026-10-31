import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { CircleNotch } from '@phosphor-icons/react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const base =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'

const styles: Record<ButtonVariant, string> = {
  primary: 'bg-slate-900 text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-900',
  secondary: 'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-400',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-600',
  ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400',
}

export const buttonClass = (variant: ButtonVariant = 'primary') => `${base} ${styles[variant]}`

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading = false, disabled, className = '', children, ...props },
  ref,
) {
  return (
    <button ref={ref} disabled={disabled || loading} className={`${buttonClass(variant)} ${className}`} {...props}>
      {loading && <CircleNotch className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
})