'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createUser } from '@/features/users/api'
import { userKeys } from '@/features/users/hooks'
import { UserForm } from '@/features/users/user-form'
import { Card } from '@/components/ui/card'

export default function NewUserPage() {
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
      <h1 className="text-2xl font-semibold">New user</h1>
      <Card>
        <UserForm
          submitLabel="Create user"
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