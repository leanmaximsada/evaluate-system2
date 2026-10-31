'use client'

import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/use-auth'
import { updateUser } from '@/features/users/api'
import { useUser, userKeys } from '@/features/users/hooks'
import { UserForm } from '@/features/users/user-form'
import { useI18n } from '@/i18n/provider'
import { getErrorMessage, getStatus } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

export default function EditUserPage() {
  const { t } = useI18n()
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user: me } = useAuth()
  const { data: user, isLoading, isError, error, refetch } = useUser(id)

  const mutation = useMutation({
    mutationFn: (values: { name: string; email: string; role: 'super_admin' | 'admin' | 'judge' }) => updateUser(id, values),
    onSuccess: (updated) => {
      queryClient.setQueryData(userKeys.detail(id), updated)
      queryClient.invalidateQueries({ queryKey: userKeys.all })
      router.push(`/users/${id}`)
    },
  })

  if (isLoading) return <InlineSpinner />
  if (isError || !user) {
    return getStatus(error) === 404
      ? <ErrorState message={t('users.not_found')} />
      : <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{t('users.edit_title')}</h1>
      <Card>
        <UserForm
          initial={user}
          submitLabel={t('users.save_changes')}
          cancelHref={`/users/${id}`}
          roleLocked={me?.id === user.id}
          onSubmit={(v) => mutation.mutateAsync({ name: v.name, email: v.email, role: v.role })}
        />
      </Card>
    </div>
  )
}