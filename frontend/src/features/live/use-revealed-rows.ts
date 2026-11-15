import { useEffect, useRef, useState } from 'react'
import type { PublicRow } from './live-results'

export const DRUM_MS = 2000

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Holds back newly revealed rows for a drum roll, then shows them. The first load, ordinary updates
 * and reduced-motion devices show rows immediately. `fresh` lists the rows that just appeared.
 */
export function useRevealedRows(rows: PublicRow[] | undefined, animate: boolean) {
  const [shown, setShown] = useState<PublicRow[] | null>(null)
  const [drum, setDrum] = useState(false)
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!rows) {
      seen.current = null
      setShown(null)
      setDrum(false)
      setFresh(new Set())
      return
    }

    const keys = new Set(rows.map((row) => row.number))
    const known = seen.current
    const added = known ? rows.filter((row) => !known.has(row.number)) : []

    if (!known || added.length === 0 || !animate || reducedMotion()) {
      seen.current = keys
      setShown(rows)
      setDrum(false)
      setFresh(new Set())
      return
    }

    setDrum(true)
    const timer = setTimeout(() => {
      seen.current = keys
      setShown(rows)
      setFresh(new Set(added.map((row) => row.number)))
      setDrum(false)
    }, DRUM_MS)

    return () => clearTimeout(timer)
  }, [rows, animate])

  return { rows: shown ?? rows ?? [], drum, fresh }
}