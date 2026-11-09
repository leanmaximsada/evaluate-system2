'use client'

import { useEffect, useRef, useState } from 'react'

export type PreviewMode = 'projector' | 'phone'

const SIZES: Record<PreviewMode, { w: number; h: number }> = {
  projector: { w: 1280, h: 720 },
  phone: { w: 390, h: 780 },
}

export function PreviewFrame({ src, mode, title }: { src: string; mode: PreviewMode; title: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const size = SIZES[mode]
  const scale = width > 0 ? Math.min(1, width / size.w) : 1

  return (
    <div ref={box} className="w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-0">
      <div style={{ width: size.w * scale, height: size.h * scale, margin: '0 auto' }}>
        <iframe
          title={title}
          src={src}
          style={{ width: size.w, height: size.h, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0 }}
        />
      </div>
    </div>
  )
}