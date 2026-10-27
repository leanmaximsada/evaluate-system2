'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { User } from '@/types'
import { applyServerErrors, getErrorMessage } from '@/lib/api'
import { Field } from '@/components/ui/field'
import { SelectField } from '@/components/ui/select-field'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { Alert } from '@/components/ui/alert'
import { RoleBadge } from '@/components/ui/role-badge'

function makeSchema(requirePassword: boolean) {
  return z
    .object({
      name: z.string().trim().min(1, 'Name is required').max(255),
      email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
      role: z.enum(['super_admin', 'admin', 'judge']),
      password: z.string().optional(),
      password_confirmation: z.string().optional(),
    })
    .superRefine((v, ctx) => {
      if (!requirePassword) return
      const pw = v.password ?? ''
      let message: string | null = null
      if (pw.length < 10) message = 'Use at least 10 characters'
      else if (!/[a-z]/.test(pw)) message = 'Include a lowercase letter'
      else if (!/[A-Z]/.test(pw)) message = 'Include an uppercase letter'
      else if (!/\d/.test(pw)) message = 'Include a number'
      if (message) ctx.addIssue({ code: 'custom', path: ['password'], message })
      if (pw !== (v.password_confirmation ?? '')) {
        ctx.addIssue({ code: 'custom', path: ['password_confirmation'], message: 'Passwords do not match' })
      }
    })
}

export type UserFormValues = z.infer<ReturnType<typeof makeSchema>>

interface Props {
  initial?: User
  submitLabel: string
  cancelHref: string
  /** True when editing your own account: the role cannot be changed. */
  roleLocked?: boolean
  onSubmit: (values: UserFormValues) => Promise<unknown>
}

export function UserForm({ initial, submitLabel, cancelHref, roleLocked = false, onSubmit }: Props) {
  const isEdit = !!initial
  const schema = useMemo(() => makeSchema(!isEdit), [isEdit])
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      email: initial?.email ?? '',
      role: initial?.role ?? 'admin',
      password: '',
      password_confirmation: '',
    },
  })

  async function submit(values: UserFormValues) {
    setFormError(null)
    try {
      await onSubmit(values)
    } catch (error) {
      if (!applyServerErrors(error, setError)) setFormError(getErrorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      {formError && <Alert kind="error">{formError}</Alert>}

      <Field label="Full name" autoComplete="off" error={errors.name?.message} {...register('name')} />
      <Field label="Email" type="email" autoComplete="off" error={errors.email?.message} {...register('email')} />

      {roleLocked && initial ? (
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700">Role</p>
          <RoleBadge role={initial.role} />
          <p className="text-xs text-slate-500">You cannot change your own role.</p>
        </div>
      ) : (
        <SelectField
          label="Role"
          error={errors.role?.message}
          hint="Judges cannot sign in to the admin system yet; they are assigned to events in a later phase."
          {...register('role')}
        >
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
          <option value="judge">Judge</option>
        </SelectField>
      )}

      {!isEdit && (
        <>
          <Field label="Password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          <Field label="Confirm password" type="password" autoComplete="new-password" error={errors.password_confirmation?.message} {...register('password_confirmation')} />
        </>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting}>{submitLabel}</Button>
        <LinkButton href={cancelHref} variant="secondary">Cancel</LinkButton>
      </div>
    </form>
  )
}