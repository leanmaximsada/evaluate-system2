'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { forgotPasswordRequest } from '@/features/auth/api'
import { useI18n } from '@/i18n/provider'
import { applyServerErrors, getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

const schema = z.object({
  email: z.string().min(1, 'val.email_required').email('val.email_invalid'),
})
type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const { t } = useI18n()
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit({ email }: FormValues) {
    setFormError(null)
    try {
      await forgotPasswordRequest(email)
      setSent(true)
    } catch (error) {
      if (!applyServerErrors(error, setError)) setFormError(getErrorMessage(error))
    }
  }

  return (
    <Card title={t('auth.reset_title')}>
      {sent ? (
        <div className="space-y-4">
          <Alert kind="success">{t('auth.link_sent')}</Alert>
          <Link href="/login" className="text-sm text-indigo-600 hover:underline">{t('auth.back_to_sign_in')}</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {formError && <Alert kind="error">{formError}</Alert>}
          <Field label={t('auth.email')} type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Button type="submit" loading={isSubmitting} className="w-full">{t('auth.send_link')}</Button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-indigo-600 hover:underline">{t('auth.back_to_sign_in')}</Link>
          </p>
        </form>
      )}
    </Card>
  )
}