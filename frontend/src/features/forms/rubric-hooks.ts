import { useQuery } from '@tanstack/react-query'
import { getRubric } from './rubric-api'

// The key starts with "forms", so invalidating the forms cache also refreshes it.
export const rubricKey = (formId: number, versionId: number) => ['forms', 'rubric', formId, versionId] as const

export const useRubric = (formId: number, versionId: number) =>
  useQuery({
    queryKey: rubricKey(formId, versionId),
    queryFn: () => getRubric(formId, versionId),
    enabled: Number.isFinite(formId) && Number.isFinite(versionId),
  })