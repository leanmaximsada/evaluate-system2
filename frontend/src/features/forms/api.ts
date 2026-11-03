import { api } from '@/lib/api'
import type { Criterion, EvaluationForm, FormStatus, FormVersion, Paginated } from '@/types'

export interface FormFilters {
  search?: string
  status?: FormStatus | ''
  page?: number
  per_page?: number
}

export interface CriterionPayload {
  name: string
  description?: string
  min_score: number
  max_score: number
  weight: number
  is_required: boolean
  is_active: boolean
}

const clean = (params: object) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined))
const base = (formId: number, versionId: number) => `/evaluation-forms/${formId}/versions/${versionId}`

export async function listForms(filters: FormFilters): Promise<Paginated<EvaluationForm>> {
  return (await api.get<Paginated<EvaluationForm>>('/evaluation-forms', { params: clean(filters) })).data
}

export async function getForm(id: number): Promise<EvaluationForm> {
  return (await api.get<{ data: EvaluationForm }>(`/evaluation-forms/${id}`)).data.data
}

export async function createForm(payload: { name: string; description?: string; is_weighted: boolean }): Promise<EvaluationForm> {
  return (await api.post<{ data: EvaluationForm }>('/evaluation-forms', payload)).data.data
}

export async function updateForm(id: number, payload: { name: string; description?: string }): Promise<EvaluationForm> {
  return (await api.put<{ data: EvaluationForm }>(`/evaluation-forms/${id}`, payload)).data.data
}

export async function setFormStatus(id: number, status: FormStatus): Promise<EvaluationForm> {
  return (await api.patch<{ data: EvaluationForm }>(`/evaluation-forms/${id}/status`, { status })).data.data
}

export async function getFormVersion(formId: number, versionId: number): Promise<FormVersion> {
  return (await api.get<{ data: FormVersion }>(base(formId, versionId))).data.data
}

export async function createFormVersion(formId: number): Promise<FormVersion> {
  return (await api.post<{ data: FormVersion }>(`/evaluation-forms/${formId}/versions`)).data.data
}

export async function updateFormVersion(formId: number, versionId: number, isWeighted: boolean): Promise<FormVersion> {
  return (await api.put<{ data: FormVersion }>(base(formId, versionId), { is_weighted: isWeighted })).data.data
}

export async function publishFormVersion(formId: number, versionId: number): Promise<FormVersion> {
  return (await api.post<{ data: FormVersion }>(`${base(formId, versionId)}/publish`)).data.data
}

export async function addCriterion(formId: number, versionId: number, payload: CriterionPayload): Promise<Criterion> {
  return (await api.post<{ data: Criterion }>(`${base(formId, versionId)}/criteria`, payload)).data.data
}

export async function updateCriterion(formId: number, versionId: number, id: number, payload: CriterionPayload): Promise<Criterion> {
  return (await api.put<{ data: Criterion }>(`${base(formId, versionId)}/criteria/${id}`, payload)).data.data
}

export const deleteCriterion = (formId: number, versionId: number, id: number) =>
  api.delete(`${base(formId, versionId)}/criteria/${id}`)

export async function reorderCriteria(formId: number, versionId: number, order: number[]): Promise<Criterion[]> {
  return (await api.put<{ data: Criterion[] }>(`${base(formId, versionId)}/criteria/order`, { order })).data.data
}