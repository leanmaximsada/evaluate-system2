import { api, ensureCsrfCookie, getStatus } from '@/lib/api'
import type { User } from '@/types'

export async function fetchMe(): Promise<User | null> {
  try {
    const res = await api.get<{ data: User }>('/auth/me')
    return res.data.data
  } catch (error) {
    const status = getStatus(error)
    if (status === 401 || status === 403) return null
    throw error
  }
}

export async function loginRequest(credentials: { email: string; password: string }): Promise<User> {
  await ensureCsrfCookie()
  const res = await api.post<{ data: User }>('/auth/login', credentials)
  return res.data.data
}

export const logoutRequest = () => api.post('/auth/logout')

export const forgotPasswordRequest = (email: string) => api.post('/auth/forgot-password', { email })

export const resetPasswordRequest = (payload: {
  token: string
  email: string
  password: string
  password_confirmation: string
}) => api.post('/auth/reset-password', payload)

export const changePasswordRequest = (payload: {
  current_password: string
  password: string
  password_confirmation: string
}) => api.put('/auth/password', payload)