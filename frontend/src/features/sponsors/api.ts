import { api } from '@/lib/api'
import type { Sponsor, SponsorTier } from '@/types'

export interface SponsorInput {
  name: string
  tier: SponsorTier
  logo?: File | null
}

function toFormData(input: SponsorInput): FormData {
  const form = new FormData()
  form.append('name', input.name)
  form.append('tier', input.tier)
  if (input.logo) form.append('logo', input.logo)
  return form
}

export async function listSponsors(eventId: number): Promise<Sponsor[]> {
  return (await api.get<{ data: Sponsor[] }>(`/events/${eventId}/sponsors`)).data.data
}

export async function createSponsor(eventId: number, input: SponsorInput): Promise<Sponsor> {
  return (await api.post<{ data: Sponsor }>(`/events/${eventId}/sponsors`, toFormData(input))).data.data
}

// POST on purpose: PHP does not read file uploads from PUT requests.
export async function updateSponsor(eventId: number, id: number, input: SponsorInput): Promise<Sponsor> {
  return (await api.post<{ data: Sponsor }>(`/events/${eventId}/sponsors/${id}`, toFormData(input))).data.data
}

export const deleteSponsor = (eventId: number, id: number) => api.delete(`/events/${eventId}/sponsors/${id}`)

export async function reorderSponsors(eventId: number, order: number[]): Promise<Sponsor[]> {
  return (await api.put<{ data: Sponsor[] }>(`/events/${eventId}/sponsors/order`, { order })).data.data
}

export async function updateDisplay(eventId: number, subtitle: string): Promise<{ public_subtitle: string | null }> {
  return (await api.patch<{ data: { public_subtitle: string | null } }>(`/events/${eventId}/display`, { public_subtitle: subtitle })).data.data
}