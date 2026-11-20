'use client'

import { useState } from 'react'
import { Trophy } from '@phosphor-icons/react'
import { useI18n } from '@/i18n/provider'

interface Props {
  /** Height of the logo. Width follows the image. */
  className?: string
  /** Show the system name next to the logo. */
  showName?: boolean
}

/**
 * The system logo. The file is black, so in dark mode it is filtered to white
 * (brightness(0) makes every visible pixel black, invert(1) makes it white).
 * If the file is missing, a small icon is shown instead.
 */
export function Logo({ className = 'h-8', showName = false }: Props) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)

  return (
    <span className="inline-flex items-center gap-2.5">
      {failed ? (
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
          <Trophy weight="fill" className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logo/logoblack.png"
          alt={t('app.name')}
          onError={() => setFailed(true)}
          className={`${className} w-auto object-contain dark:brightness-0 dark:invert`}
        />
      )}
      {showName && <span className="font-semibold tracking-tight text-slate-900">{t('app.name')}</span>}
    </span>
  )
}