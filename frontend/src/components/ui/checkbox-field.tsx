import { forwardRef, useId, type InputHTMLAttributes } from 'react'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  hint?: string
}

export const CheckboxField = forwardRef<HTMLInputElement, Props>(function CheckboxField(
  { label, hint, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId

  return (
    <div className="flex items-start gap-3">
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-slate-900"
        {...props}
      />
      <div className="min-w-0">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-900">{label}</label>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
})