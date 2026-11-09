'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n/provider'
import type { PublicSponsor, SponsorTier } from '@/types'

const ORDER: SponsorTier[] = ['diamond', 'gold', 'silver', 'supporter']
// Higher levels get larger logos, as on the sample leaderboard.
const HEIGHT: Record<SponsorTier, string> = {
  diamond: 'h-[clamp(48px,9vh,110px)]',
  gold: 'h-[clamp(40px,7vh,90px)]',
  silver: 'h-[clamp(32px,5.5vh,72px)]',
  supporter: 'h-[clamp(28px,4.5vh,60px)]',
}

function Logo({ sponsor }: { sponsor: PublicSponsor }) {
  const [failed, setFailed] = useState(false)

  if (failed) return <span className="px-2 text-sm font-semibold text-slate-700">{sponsor.name}</span>

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={sponsor.logo_url} alt={sponsor.name} onError={() => setFailed(true)} className={`${HEIGHT[sponsor.tier]} w-auto max-w-[40vw] object-contain`} />
  )
}

export function SponsorStrip({ sponsors }: { sponsors: PublicSponsor[] }) {
  const { t } = useI18n()
  const groups = ORDER.map((tier) => ({ tier, items: sponsors.filter((s) => s.tier === tier) })).filter((g) => g.items.length > 0)

  if (groups.length === 0) return null

  return (
    <section aria-label={t('sponsors.title')} className="mb-8 flex flex-wrap items-end justify-center gap-x-6 gap-y-4">
      {groups.map(({ tier, items }) => (
        <div key={tier} className="min-w-0">
          <p className="mb-1 text-center text-[clamp(0.7rem,1.1vw,1rem)] font-medium text-white/80">{t(`sponsor.tier_${tier}`)}</p>
          <ul className="flex flex-wrap items-center justify-center gap-4 rounded-xl bg-white px-4 py-3 shadow-lg">
            {items.map((s) => <li key={`${s.name}-${s.logo_url}`}><Logo sponsor={s} /></li>)}
          </ul>
        </div>
      ))}
    </section>
  )
}