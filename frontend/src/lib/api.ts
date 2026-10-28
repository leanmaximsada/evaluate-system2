import axios, { AxiosError } from 'axios'
import type { UseFormSetError, FieldValues, Path } from 'react-hook-form'
import { readLocaleCookie, translate } from '@/i18n/core' 

const baseURL = process.env.NEXT_PUBLIC_API_URL as string

const config = {
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
}

export const http = axios.create({ baseURL, ...config })
export const api = axios.create({ baseURL: `${baseURL}/api/v1`, ...config })

export const ensureCsrfCookie = () => http.get('/sanctum/csrf-cookie')

interface ApiErrorBody {
  message?: string
  errors?: Record<string, string[]>
}

export function getStatus(error: unknown): number | undefined {
  return (error as AxiosError | undefined)?.response?.status
}

for (const client of [http, api]) {
  client.interceptors.request.use((request) => {
    request.headers.set('Accept-Language', readLocaleCookie())
    return request
  })
}

export function getErrorMessage(error: unknown): string {
  const locale = readLocaleCookie()
  const err = error as AxiosError<ApiErrorBody>
  if (!err?.response) return translate(locale, 'err.network')
  if (err.response.status === 429) return translate(locale, 'err.too_many')
  if (err.response.status >= 500) return translate(locale, 'err.server')
  return err.response.data?.message ?? translate(locale, 'err.request_failed')
}

/** Puts Laravel's 422 field errors next to the matching form fields. Returns true if any were applied. */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): boolean {
  const err = error as AxiosError<ApiErrorBody>
  const errors = err?.response?.status === 422 ? err.response.data?.errors : undefined
  if (!errors) return false
  Object.entries(errors).forEach(([field, messages]) => {
    setError(field as Path<T>, { type: 'server', message: messages[0] })
  })
  return true
}