import axios, { AxiosError } from 'axios'
import type { UseFormSetError, FieldValues, Path } from 'react-hook-form'

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

export function getErrorMessage(error: unknown): string {
  const err = error as AxiosError<ApiErrorBody>
  if (!err?.response) return 'Cannot reach the server. Check your connection and try again.'
  if (err.response.status === 429) return 'Too many attempts. Please wait a minute and try again.'
  if (err.response.status >= 500) return 'Something went wrong on the server. Please try again.'
  return err.response.data?.message ?? 'Request failed.'
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