'use client'

import { Translate } from '@phosphor-icons/react'
import { useI18n } from '@/i18n/provider'

const OPTIONS = [
  { locale: 'en', label: 'EN' },
  { locale: 'km', label: 'ខ្មែរ' },
] as const

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div role="group" aria-label={t('lang.label')} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white p-0.5 text-sm">
      <Translate className="ml-1.5 h-4 w-4 text-slate-500" aria-hidden="true" />
      {OPTIONS.map((o) => (
        <button
          key={o.locale}
          type="button"
          lang={o.locale}
          aria-pressed={locale === o.locale}
          onClick={() => setLocale(o.locale)}
          className={`rounded px-2 py-1 font-medium ${locale === o.locale ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}