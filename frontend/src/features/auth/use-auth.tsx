'use client'

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { User } from '@/types'
import { fetchMe, loginRequest, logoutRequest } from './api'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (credentials: { email: string; password: string }) => Promise<User>
  logout: () => Promise<void>
  can: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    staleTime: 60_000,
  })

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      const loggedIn = await loginRequest(credentials)
      queryClient.setQueryData(['me'], loggedIn)
      return loggedIn
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      queryClient.clear()
      queryClient.setQueryData(['me'], null)
    }
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      isLoading,
      login,
      logout,
      // UI hint only. Laravel enforces every permission again on each request.
      can: (permission) => !!user && user.permissions.includes(permission),
    }),
    [user, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}