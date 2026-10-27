'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Pencil, UserCheck, UserX } from 'lucide-react'
import { useAuth } from '@/features/auth/use-auth'
import { sendPasswordReset, setUserStatus } from '@/features/users/api'
import { useUser, userKeys } from '@/features/users/hooks'
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
      setFeedback({ kind: 'success', text: updated.is_active ? 'Account activated.' : 'Account deactivated.' })
    },
    onError: (e) => setFeedback({ kind: 'error', text: getErrorMessage(e) }),
    onSettled: () => setConfirm(null),
  })

  const resetMutation = useMutation({
    mutationFn: () => sendPasswordReset(id),
    onSuccess: () => setFeedback({ kind: 'success', text: 'Password reset link sent.' }),
    onError: (e) => setFeedback({ kind: 'error', text: getErrorMessage(e) }),
    onSettled: () => setConfirm(null),
  })

  if (isLoading) return <InlineSpinner />
  if (isError || !user) {
    return getStatus(error) === 404
      ? <ErrorState message="User not found." />
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
          <Pencil className="h-4 w-4" aria-hidden="true" />Edit
        </LinkButton>
      </div>

      {feedback && <Alert kind={feedback.kind}>{feedback.text}</Alert>}

      <Card title="Details">
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{user.email}</dd></div>
          <div><dt className="text-slate-500">Last sign-in</dt><dd className="font-medium">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}</dd></div>
          <div><dt className="text-slate-500">Created</dt><dd className="font-medium">{new Date(user.created_at).toLocaleString()}</dd></div>
          <div><dt className="text-slate-500">Last updated</dt><dd className="font-medium">{new Date(user.updated_at).toLocaleString()}</dd></div>
        </dl>
      </Card>

      <Card title="Security">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setConfirm('reset')} disabled={!user.is_active}>
            <KeyRound className="h-4 w-4" aria-hidden="true" />Send password reset link
          </Button>
          <Button
            variant={user.is_active ? 'danger' : 'primary'}
            onClick={() => setConfirm('status')}
            disabled={isSelf && user.is_active}
            title={isSelf ? 'You cannot deactivate your own account' : undefined}
          >
            {user.is_active
              ? <><UserX className="h-4 w-4" aria-hidden="true" />Deactivate account</>
              : <><UserCheck className="h-4 w-4" aria-hidden="true" />Activate account</>}
          </Button>
        </div>
        {isSelf && <p className="mt-3 text-xs text-slate-500">This is your own account, so it cannot be deactivated here.</p>}
      </Card>

      <ConfirmDialog
        open={confirm === 'status'}
        title={user.is_active ? 'Deactivate this account?' : 'Activate this account?'}
        message={
          user.is_active
            ? `${user.name} will be signed out immediately and will not be able to sign in until the account is reactivated.`
            : `${user.name} will be able to sign in again.`
        }
        confirmLabel={user.is_active ? 'Deactivate' : 'Activate'}
        danger={user.is_active}
        loading={statusMutation.isPending}
        onConfirm={() => statusMutation.mutate(!user.is_active)}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === 'reset'}
        title="Send a password reset link?"
        message={`An email with a reset link will be sent to ${user.email}.`}
        confirmLabel="Send link"
        loading={resetMutation.isPending}
        onConfirm={() => resetMutation.mutate()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}