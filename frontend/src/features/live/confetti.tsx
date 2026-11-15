'use client'

import { useEffect, useState } from 'react'

const COLORS = ['#fbbf24', '#f87171', '#34d399', '#60a5fa', '#c084fc']

/** Falls for a few seconds, then removes itself. */
export function Confetti() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 6500)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 60 }, (_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i * 37) % 100}%`,
            backgroundColor: COLORS[i % COLORS.length],
            animationDelay: `${(i % 10) * 0.15}s`,
            animationDuration: `${3 + (i % 5) * 0.5}s`,
          }}
        />
      ))}
    </div>
  )
}