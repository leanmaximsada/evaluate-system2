'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import { changePasswordRequest } from '@/features/auth/api'
import { applyServerErrors, getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { RoleBadge } from '@/components/ui/role-badge'

const schema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/\d/, 'Include a number'),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Passwords do not match',
  })

type FormValues = z.infer<typeof schema>

export default function ProfilePage() {
  const { user } = useAuth()
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
      <h1 className="text-2xl font-semibold">Profile</h1>

      <Card title="Account">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{user.name}</dd></div>
          <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{user.email}</dd></div>
          <div><dt className="text-slate-500">Role</dt><dd><RoleBadge role={user.role} /></dd></div>
          <div>
            <dt className="text-slate-500">Last sign-in</dt>
            <dd className="font-medium">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'n/a'}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Change password">
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          {success && <Alert kind="success">Password updated.</Alert>}
          {formError && <Alert kind="error">{formError}</Alert>}
          <Field label="Current password" type="password" autoComplete="current-password" error={errors.current_password?.message} {...register('current_password')} />
          <Field label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          <Field label="Confirm new password" type="password" autoComplete="new-password" error={errors.password_confirmation?.message} {...register('password_confirmation')} />
          <Button type="submit" loading={mutation.isPending}>Update password</Button>
        </form>
      </Card>
    </div>
  )
}