import { CircleNotch } from '@phosphor-icons/react'

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
      <CircleNotch className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  )
}

export function InlineSpinner() {
  return (
    <div className="flex justify-center py-12" role="status" aria-label="Loading">
      <CircleNotch className="h-6 w-6 animate-spin text-indigo-600" />
    </div>
  )
}