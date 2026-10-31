'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { User } from '@/types'
import { useI18n } from '@/i18n/provider'
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
      name: z.string().trim().min(1, 'val.name_required').max(255, 'val.name_max'),
      email: z.string().trim().min(1, 'val.email_required').email('val.email_invalid'),
      role: z.enum(['super_admin', 'admin', 'judge']),
      password: z.string().optional(),
      password_confirmation: z.string().optional(),
    })
    .superRefine((v, ctx) => {
      if (!requirePassword) return
      const pw = v.password ?? ''
      let message: string | null = null
      if (pw.length < 10) message = 'val.password_min'
      else if (!/[a-z]/.test(pw)) message = 'val.password_lower'
      else if (!/[A-Z]/.test(pw)) message = 'val.password_upper'
      else if (!/\d/.test(pw)) message = 'val.password_number'
      if (message) ctx.addIssue({ code: 'custom', path: ['password'], message })
      if (pw !== (v.password_confirmation ?? '')) {
        ctx.addIssue({ code: 'custom', path: ['password_confirmation'], message: 'val.password_mismatch' })
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
  const { t } = useI18n()
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

      <Field label={t('users.full_name')} autoComplete="off" error={errors.name?.message} {...register('name')} />
      <Field label={t('users.email')} type="email" autoComplete="off" error={errors.email?.message} {...register('email')} />

      {roleLocked && initial ? (
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700">{t('users.role')}</p>
          <RoleBadge role={initial.role} />
          <p className="text-xs text-slate-500">{t('users.role_locked')}</p>
        </div>
      ) : (
        <SelectField label={t('users.role')} error={errors.role?.message} hint={t('users.role_hint')} {...register('role')}>
          <option value="admin">{t('role.admin')}</option>
          <option value="super_admin">{t('role.super_admin')}</option>
          <option value="judge">{t('role.judge')}</option>
        </SelectField>
      )}

      {!isEdit && (
        <>
          <Field label={t('users.password')} type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          <Field label={t('users.confirm_password')} type="password" autoComplete="new-password" error={errors.password_confirmation?.message} {...register('password_confirmation')} />
        </>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting}>{submitLabel}</Button>
        <LinkButton href={cancelHref} variant="secondary">{t('common.cancel')}</LinkButton>
      </div>
    </form>
  )
}