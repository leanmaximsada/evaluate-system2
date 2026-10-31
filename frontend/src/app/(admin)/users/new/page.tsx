'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createUser } from '@/features/users/api'
import { userKeys } from '@/features/users/hooks'
import { UserForm } from '@/features/users/user-form'
import { useI18n } from '@/i18n/provider'
import { Card } from '@/components/ui/card'

export default function NewUserPage() {
  const { t } = useI18n()
  const router = useRouter()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all })
      router.push(`/users/${user.id}`)
    },
  })

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{t('users.new_user')}</h1>
      <Card>
        <UserForm
          submitLabel={t('users.create_submit')}
          cancelHref="/users"
          onSubmit={(v) =>
            mutation.mutateAsync({
              name: v.name,
              email: v.email,
              role: v.role,
              password: v.password ?? '',
              password_confirmation: v.password_confirmation ?? '',
            })
          }
        />
      </Card>
    </div>
  )
}