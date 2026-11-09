import { api } from '@/lib/api'
import type { DisplayChecks, PublicVisibility } from '@/types'
import type { PublicResults } from '@/features/live/live-results'

export type DisplayPreview = PublicResults & { is_preview: true; checks: DisplayChecks }

export interface DisplaySettings {
  public_subtitle: string | null
  organization_name: string | null
  organization_logo_url: string | null
  display_visibility: PublicVisibility
}

export interface DisplaySettingsInput {
  public_subtitle?: string
  organization_name?: string
  display_visibility?: PublicVisibility
}

export async function getDisplayPreview(eventId: number): Promise<DisplayPreview> {
  return (await api.get<{ data: DisplayPreview }>(`/events/${eventId}/results/preview`)).data.data
}

export async function saveDisplaySettings(eventId: number, input: DisplaySettingsInput): Promise<DisplaySettings> {
  return (await api.patch<{ data: DisplaySettings }>(`/events/${eventId}/display`, input)).data.data
}

// POST on purpose: PHP does not read file uploads from PUT requests.
export async function uploadOrganizationLogo(eventId: number, file: File): Promise<DisplaySettings> {
  const form = new FormData()
  form.append('logo', file)
  return (await api.post<{ data: DisplaySettings }>(`/events/${eventId}/display/logo`, form)).data.data
}

export async function removeOrganizationLogo(eventId: number): Promise<DisplaySettings> {
  return (await api.delete<{ data: DisplaySettings }>(`/events/${eventId}/display/logo`)).data.data
}