'use client'

import type { Criterion } from '@/types'
import { useI18n } from '@/i18n/provider'
import { Card } from '@/components/ui/card'

export function FormPreview({ criteria, weighted }: { criteria: Criterion[]; weighted: boolean }) {
  const { t } = useI18n()
  const active = criteria.filter((c) => c.is_active)

  return (
    <Card title={t('forms.preview')} description={t('forms.preview_hint')}>
      {active.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{t('forms.preview_empty')}</p>
      ) : (
        <ul className="space-y-4">
          {active.map((c) => (
            <li key={c.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {c.name}
                    {c.is_required && <span className="ml-2 rounded bg-slate-900 px-1.5 py-0.5 text-xs font-medium text-white">{t('forms.required')}</span>}
                  </p>
                  {c.description && <p className="mt-1 text-sm text-slate-600">{c.description}</p>}
                </div>
                <p className="text-xs text-slate-500">
                  {t('forms.preview_range', { min: c.min_score, max: c.max_score })}
                  {weighted && ` · ${t('forms.preview_weight', { w: c.weight })}`}
                </p>
              </div>
              <input
                type="number"
                disabled
                aria-label={c.name}
                placeholder={t('forms.preview_placeholder')}
                className="mt-3 h-10 w-40 rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:opacity-60"
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}