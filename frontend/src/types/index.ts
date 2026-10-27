export type Role = 'super_admin' | 'admin' | 'judge'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  is_active: boolean
  permissions: string[]
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface Paginated<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
    from: number | null
    to: number | null
  }
}