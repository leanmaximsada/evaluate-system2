import { api } from '@/lib/api'
import type { Paginated, Role, User } from '@/types'

export interface UserFilters {
  search?: string
  role?: Role | ''
  status?: 'active' | 'inactive' | ''
  page?: number
  per_page?: number
  sort?: string
  direction?: 'asc' | 'desc'
}

export interface UpdateUserPayload {
  name: string
  email: string
  role: Role
}

export interface CreateUserPayload extends UpdateUserPayload {
  password: string
  password_confirmation: string
}

function clean(params: UserFilters) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined))
}

export async function listUsers(filters: UserFilters): Promise<Paginated<User>> {
  return (await api.get<Paginated<User>>('/users', { params: clean(filters) })).data
}

export async function getUser(id: number): Promise<User> {
  return (await api.get<{ data: User }>(`/users/${id}`)).data.data
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  return (await api.post<{ data: User }>('/users', payload)).data.data
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<User> {
  return (await api.put<{ data: User }>(`/users/${id}`, payload)).data.data
}

export async function setUserStatus(id: number, isActive: boolean): Promise<User> {
  return (await api.patch<{ data: User }>(`/users/${id}/status`, { is_active: isActive })).data.data
}

export const sendPasswordReset = (id: number) => api.post(`/users/${id}/password-reset`)