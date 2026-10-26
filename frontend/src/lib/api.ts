import axios from 'axios'

const baseURL = process.env.NEXT_PUBLIC_API_URL as string

const config = {
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
}

export const http = axios.create({ baseURL, ...config })
export const api = axios.create({ baseURL: `${baseURL}/api/v1`, ...config })

export const ensureCsrfCookie = () => http.get('/sanctum/csrf-cookie')