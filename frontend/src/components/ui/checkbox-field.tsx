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
      <input ref={ref} id={inputId} type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600" {...props} />
      <div>
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">{label}</label>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
})