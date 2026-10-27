'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { forgotPasswordRequest } from '@/features/auth/api'
import { applyServerErrors, getErrorMessage } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
})
type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
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
    <Card title="Reset your password">
      {sent ? (
        <div className="space-y-4">
          <Alert kind="success">If that email address is registered, a reset link has been sent.</Alert>
          <Link href="/login" className="text-sm text-indigo-600 hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {formError && <Alert kind="error">{formError}</Alert>}
          <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Button type="submit" loading={isSubmitting} className="w-full">Send reset link</Button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-indigo-600 hover:underline">Back to sign in</Link>
          </p>
        </form>
      )}
    </Card>
  )
}