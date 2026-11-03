'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createForm } from '@/features/forms/api'
import { formKeys } from '@/features/forms/hooks'
import { FormDetailsForm } from '@/features/forms/form-details-form'
import { useI18n } from '@/i18n/provider'
import { Card } from '@/components/ui/card'

export default function NewFormPage() {
  const { t } = useI18n()
  const router = useRouter()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: createForm,
    onSuccess: (form) => {
      queryClient.invalidateQueries({ queryKey: formKeys.all })
      router.push(`/forms/${form.id}`)
    },
  })

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">{t('forms.new')}</h1>
      <Card>
        <FormDetailsForm
          showWeighted
          submitLabel={t('forms.create_submit')}
          cancelHref="/forms"
          onSubmit={(v) => mutation.mutateAsync({ name: v.name, description: v.description, is_weighted: v.is_weighted })}
        />
      </Card>
    </div>
  )
}