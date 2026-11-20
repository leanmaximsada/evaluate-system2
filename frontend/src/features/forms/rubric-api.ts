import { api } from '@/lib/api'
import type { RubricColor, RubricLevel } from '@/types'

export interface RubricLevelInput {
  name: string
  name_km: string | null
  min_percent: string
  color: RubricColor
  descriptions: Record<string, string>
}

const path = (formId: number, versionId: number) => `/evaluation-forms/${formId}/versions/${versionId}/rubric`

export async function getRubric(formId: number, versionId: number): Promise<{ levels: RubricLevel[] }> {
  return (await api.get<{ data: { levels: RubricLevel[] } }>(path(formId, versionId))).data.data
}

export async function saveRubric(formId: number, versionId: number, levels: RubricLevelInput[]): Promise<{ levels: RubricLevel[] }> {
  return (await api.put<{ data: { levels: RubricLevel[] } }>(path(formId, versionId), { levels })).data.data
}