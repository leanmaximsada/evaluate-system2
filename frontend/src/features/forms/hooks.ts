import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getForm, getFormVersion, listForms, type FormFilters } from './api'

export const formKeys = {
  all: ['forms'] as const,
  list: (f: FormFilters) => ['forms', 'list', f] as const,
  detail: (id: number) => ['forms', 'detail', id] as const,
  version: (formId: number, versionId: number) => ['forms', 'version', formId, versionId] as const,
}

export const useForms = (filters: FormFilters, enabled = true) =>
  useQuery({ queryKey: formKeys.list(filters), queryFn: () => listForms(filters), placeholderData: keepPreviousData, enabled })

export const useEvaluationForm = (id: number) =>
  useQuery({ queryKey: formKeys.detail(id), queryFn: () => getForm(id), enabled: Number.isFinite(id) })

export const useFormVersion = (formId: number, versionId: number | undefined) =>
  useQuery({
    queryKey: formKeys.version(formId, versionId ?? 0),
    queryFn: () => getFormVersion(formId, versionId as number),
    enabled: Number.isFinite(formId) && versionId !== undefined,
  })