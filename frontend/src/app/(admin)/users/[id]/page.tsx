'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Key, PencilSimple, UserCheck, UserMinus } from '@phosphor-icons/react'
import { useAuth } from '@/features/auth/use-auth'
import { sendPasswordReset, setUserStatus } from '@/features/users/api'
import { useUser, userKeys } from '@/features/users/hooks'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage, getStatus } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { Alert } from '@/components/ui/alert'
import { RoleBadge } from '@/components/ui/role-badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

type Feedback = { kind: 'success' | 'error'; text: string }

export default function UserDetailsPage() {
  const { t, formatDateTime } = useI18n()
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const { data: user, isLoading, isError, error, refetch } = useUser(id)

  const [confirm, setConfirm] = useState<'status' | 'reset' | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const statusMutation = useMutation({
    mutationFn: (active: boolean) => setUserStatus(id, active),
    onSuccess: (updated) => {
      queryClient.setQueryData(userKeys.detail(id), updated)
      queryClient.invalidateQueries({ queryKey: userKeys.all })
      setFeedback({ kind: 'success', text: updated.is_active ? t('users.account_activated') : t('users.account_deactivated') })
    },
    onError: (e) => setFeedback({ kind: 'error', text: getErrorMessage(e) }),
    onSettled: () => setConfirm(null),
  })

  const resetMutation = useMutation({
    mutationFn: () => sendPasswordReset(id),
    onSuccess: () => setFeedback({ kind: 'success', text: t('users.reset_sent') }),
    onError: (e) => setFeedback({ kind: 'error', text: getErrorMessage(e) }),
    onSettled: () => setConfirm(null),
  })

  if (isLoading) return <InlineSpinner />
  if (isError || !user) {
    return getStatus(error) === 404
      ? <ErrorState message={t('users.not_found')} />
      : <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
  }

  const isSelf = me?.id === user.id

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <RoleBadge role={user.role} />
          <StatusBadge active={user.is_active} />
        </div>
        <LinkButton href={`/users/${user.id}/edit`} variant="secondary">
          <PencilSimple className="h-4 w-4" aria-hidden="true" />{t('common.edit')}
        </LinkButton>
      </div>

      {feedback && <Alert kind={feedback.kind}>{feedback.text}</Alert>}

      <Card title={t('users.details')}>
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">{t('users.email')}</dt><dd className="font-medium">{user.email}</dd></div>
          <div><dt className="text-slate-500">{t('users.col_last_signin')}</dt><dd className="font-medium">{user.last_login_at ? formatDateTime(user.last_login_at) : t('common.never')}</dd></div>
          <div><dt className="text-slate-500">{t('users.created')}</dt><dd className="font-medium">{formatDateTime(user.created_at)}</dd></div>
          <div><dt className="text-slate-500">{t('users.last_updated')}</dt><dd className="font-medium">{formatDateTime(user.updated_at)}</dd></div>
        </dl>
      </Card>

      <Card title={t('users.security')}>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setConfirm('reset')} disabled={!user.is_active}>
            <Key className="h-4 w-4" aria-hidden="true" />{t('users.send_reset')}
          </Button>
          <Button
            variant={user.is_active ? 'danger' : 'primary'}
            onClick={() => setConfirm('status')}
            disabled={isSelf && user.is_active}
            title={isSelf ? t('users.self_title') : undefined}
          >
            {user.is_active
              ? <><UserMinus className="h-4 w-4" aria-hidden="true" />{t('users.deactivate')}</>
              : <><UserCheck className="h-4 w-4" aria-hidden="true" />{t('users.activate')}</>}
          </Button>
        </div>
        {isSelf && <p className="mt-3 text-xs text-slate-500">{t('users.self_note')}</p>}
      </Card>

      <ConfirmDialog
        open={confirm === 'status'}
        title={user.is_active ? t('users.confirm_deactivate_title') : t('users.confirm_activate_title')}
        message={user.is_active ? t('users.confirm_deactivate_text', { name: user.name }) : t('users.confirm_activate_text', { name: user.name })}
        confirmLabel={user.is_active ? t('users.confirm_deactivate') : t('users.confirm_activate')}
        danger={user.is_active}
        loading={statusMutation.isPending}
        onConfirm={() => statusMutation.mutate(!user.is_active)}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === 'reset'}
        title={t('users.confirm_reset_title')}
        message={t('users.confirm_reset_text', { email: user.email })}
        confirmLabel={t('users.confirm_reset')}
        loading={resetMutation.isPending}
        onConfirm={() => resetMutation.mutate()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}