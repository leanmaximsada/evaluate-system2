'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n/provider'

interface Props {
  src: string
  alt: string
  phone?: boolean
  priority?: boolean
}

/** A screenshot in a browser or phone frame. A missing file shows a neutral placeholder. */
export function Screenshot({ src, alt, phone = false, priority = false }: Props) {
  const { t } = useI18n()
  const ref = useRef<HTMLImageElement>(null)
  const [missing, setMissing] = useState(false)

  // An error that happened before React attached its handler would otherwise be missed.
  useEffect(() => {
    const img = ref.current
    if (img && img.complete && img.naturalWidth === 0) setMissing(true)
  }, [])

  const image = missing ? (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 p-4 text-center text-sm text-slate-500">
      {t('landing.shot_missing')}
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      onError={() => setMissing(true)}
      className="h-full w-full object-cover object-top"
    />
  )

  if (phone) {
    return (
      <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[2rem] border-[6px] border-slate-300 bg-[#ffffff] shadow-xl">
        <div className="aspect-[9/19]">{image}</div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#ffffff] shadow-xl">
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-4 py-2.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
      </div>
      <div className="aspect-[16/10]">{image}</div>
    </div>
  )
}