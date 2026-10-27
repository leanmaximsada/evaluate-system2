import type { Paginated } from '@/types'
import { Button } from './button'

export function Pagination({
  meta,
  onPage,
  disabled = false,
}: {
  meta: Paginated<unknown>['meta']
  onPage: (page: number) => void
  disabled?: boolean
}) {
  if (meta.total === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <p>Showing {meta.from}–{meta.to} of {meta.total}</p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={disabled || meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}>
          Previous
        </Button>
        <span>Page {meta.current_page} of {meta.last_page}</span>
        <Button variant="secondary" disabled={disabled || meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}