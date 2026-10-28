'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { resetPasswordRequest } from '@/features/auth/api'
import { newPasswordSchema } from '@/features/auth/password-schema'
import { useI18n } from '@/i18n/provider'
import { applyServerErrors, getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

const schema = z
  .object({
    password: newPasswordSchema,
    password_confirmation: z.string(),
    // Not a visible field: the server reports an expired or invalid token under "email".
    email: z.string().optional(),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    message: 'val.password_mismatch',
  })
type FormValues = z.infer<typeof schema>

export function ResetPasswordForm() {
  const { t, tx } = useI18n()
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (!token || !email) {
    return (
      <Card title={t('auth.invalid_link_title')}>
        <p className="mb-4 text-sm text-slate-600">{t('auth.invalid_link_text')}</p>
        <Link href="/forgot-password" className="text-sm text-indigo-600 hover:underline">{t('auth.request_new_link')}</Link>
      </Card>
    )
  }

  async function onSubmit(values: FormValues) {
    setFormError(null)
    try {
      await resetPasswordRequest({
        token,
        email,
        password: values.password,
        password_confirmation: values.password_confirmation,
      })
      router.replace('/login')
    } catch (error) {
      if (!applyServerErrors(error, setError)) setFormError(getErrorMessage(error))
    }
  }

  return (
    <Card title={t('auth.choose_password')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError && <Alert kind="error">{formError}</Alert>}
        {errors.email?.message && <Alert kind="error">{tx(errors.email.message)}</Alert>}
        <Field label={t('auth.new_password')} type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
        <Field label={t('auth.confirm_new_password')} type="password" autoComplete="new-password" error={errors.password_confirmation?.message} {...register('password_confirmation')} />
        <Button type="submit" loading={isSubmitting} className="w-full">{t('auth.reset_password')}</Button>
      </form>
    </Card>
  )
}