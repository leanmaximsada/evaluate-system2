'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { resetPasswordRequest } from '@/features/auth/api'
import { applyServerErrors, getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

const schema = z
  .object({
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
type FormValues = z.infer<typeof schema> & { email?: string }

export function ResetPasswordForm() {
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
      <Card title="Invalid link">
        <p className="mb-4 text-sm text-slate-600">This reset link is missing information. Request a new one.</p>
        <Link href="/forgot-password" className="text-sm text-indigo-600 hover:underline">Request a new link</Link>
      </Card>
    )
  }

  async function onSubmit(values: FormValues) {
    setFormError(null)
    try {
      await resetPasswordRequest({ token, email, ...values })
      router.replace('/login')
    } catch (error) {
      // Token and email errors come back keyed to "email"; show them as a form-level message.
      const handled = applyServerErrors(error, setError)
      if (!handled) setFormError(getErrorMessage(error))
    }
  }

  return (
    <Card title="Choose a new password">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError && <Alert kind="error">{formError}</Alert>}
        {(errors as { email?: { message?: string } }).email?.message && (
  <Alert kind="error">{(errors as { email?: { message?: string } }).email?.message}</Alert>)}
        {errors.root?.message && <Alert kind="error">{errors.root.message}</Alert>}
        <Field label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
        <Field label="Confirm new password" type="password" autoComplete="new-password" error={errors.password_confirmation?.message} {...register('password_confirmation')} />
        <Button type="submit" loading={isSubmitting} className="w-full">Reset password</Button>
      </form>
    </Card>
  )
}