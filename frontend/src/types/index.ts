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

export interface SettingsData {
  general: {
    system_name: string
    default_language: 'en' | 'km'
    timezone: string
    date_format: 'Y-m-d' | 'd/m/Y' | 'm/d/Y' | 'd M Y'
    time_format: '24h' | '12h'
    pagination_size: number
  }
  evaluation: {
    min_score: number
    max_score: number
    score_precision: number
    tie_policy: 'standard' | 'dense'
    show_tie_indicator: boolean
    live_provisional_enabled: boolean
    default_result_visibility: 'rank_and_score' | 'rank_only' | 'hidden'
  }
}

export interface SystemInfo {
  environment: string
  debug: boolean
  php_version: string
  laravel_version: string
  database_driver: string
  queue_driver: string
  broadcast_driver: string
  timezone: string
}