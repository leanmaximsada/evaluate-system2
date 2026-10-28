'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import { changePasswordRequest } from '@/features/auth/api'
import { newPasswordSchema } from '@/features/auth/password-schema'
import { useI18n } from '@/i18n/provider'
import { applyServerErrors, getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { RoleBadge } from '@/components/ui/role-badge'

const schema = z
  .object({
    current_password: z.string().min(1, 'val.current_required'),
    password: newPasswordSchema,
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    message: 'val.password_mismatch',
  })

type FormValues = z.infer<typeof schema>

export default function ProfilePage() {
  const { user } = useAuth()
  const { t, formatDateTime } = useI18n()
  const [success, setSuccess] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: changePasswordRequest,
    onSuccess: () => {
      setSuccess(true)
      setFormError(null)
      reset()
    },
    onError: (error) => {
      setSuccess(false)
      if (!applyServerErrors(error, setError)) setFormError(getErrorMessage(error))
    },
  })

  if (!user) return null

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>

      <Card title={t('profile.account')}>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">{t('profile.name')}</dt><dd className="font-medium">{user.name}</dd></div>
          <div><dt className="text-slate-500">{t('profile.email')}</dt><dd className="font-medium">{user.email}</dd></div>
          <div><dt className="text-slate-500">{t('profile.role')}</dt><dd><RoleBadge role={user.role} /></dd></div>
          <div><dt className="text-slate-500">{t('profile.last_signin')}</dt><dd className="font-medium">{formatDateTime(user.last_login_at)}</dd></div>
        </dl>
      </Card>

      <Card title={t('profile.change_password')}>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          {success && <Alert kind="success">{t('profile.password_updated')}</Alert>}
          {formError && <Alert kind="error">{formError}</Alert>}
          <Field label={t('profile.current_password')} type="password" autoComplete="current-password" error={errors.current_password?.message} {...register('current_password')} />
          <Field label={t('auth.new_password')} type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          <Field label={t('auth.confirm_new_password')} type="password" autoComplete="new-password" error={errors.password_confirmation?.message} {...register('password_confirmation')} />
          <Button type="submit" loading={mutation.isPending}>{t('profile.update_password')}</Button>
        </form>
      </Card>
    </div>
  )
}