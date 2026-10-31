'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/features/auth/use-auth'
import { useI18n } from '@/i18n/provider'
import { applyServerErrors, getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

const schema = z.object({
  email: z.string().min(1, 'val.email_required').email('val.email_invalid'),
  password: z.string().min(1, 'val.password_required'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const { user, isLoading, login } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!isLoading && user) router.replace('/dashboard')
  }, [isLoading, user, router])

  async function onSubmit(values: FormValues) {
    setFormError(null)
    try {
      await login(values)
      router.replace('/dashboard')
    } catch (error) {
      if (!applyServerErrors(error, setError)) setFormError(getErrorMessage(error))
    }
  }

  return (
    <Card title={t('auth.sign_in')} description={t('auth.subtitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError && <Alert kind="error">{formError}</Alert>}
        <Field label={t('auth.email')} type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Field label={t('auth.password')} type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <Button type="submit" loading={isSubmitting} className="w-full">{t('auth.sign_in')}</Button>
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="text-indigo-600 hover:underline">{t('auth.forgot_link')}</Link>
        </p>
      </form>
    </Card>
  )
}