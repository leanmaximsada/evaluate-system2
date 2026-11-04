import { api } from '@/lib/api'
import type { JudgeEvaluation, JudgeEventDetail, JudgeEventSummary, JudgeParticipantDetail } from '@/types'

const path = (eventId: number, participantId: number) => `/judge/events/${eventId}/participants/${participantId}`

export async function listJudgeEvents(): Promise<JudgeEventSummary[]> {
  return (await api.get<{ data: JudgeEventSummary[] }>('/judge/events')).data.data
}

export async function getJudgeEvent(id: number): Promise<JudgeEventDetail> {
  return (await api.get<{ data: JudgeEventDetail }>(`/judge/events/${id}`)).data.data
}

export async function getJudgeParticipant(eventId: number, participantId: number): Promise<JudgeParticipantDetail> {
  return (await api.get<{ data: JudgeParticipantDetail }>(path(eventId, participantId))).data.data
}

export async function saveJudgeDraft(eventId: number, participantId: number, scores: Record<string, string>): Promise<JudgeEvaluation> {
  return (await api.put<{ data: { evaluation: JudgeEvaluation } }>(`${path(eventId, participantId)}/draft`, { scores })).data.data.evaluation
}

export async function submitJudgeScores(eventId: number, participantId: number, scores: Record<string, string>): Promise<JudgeEvaluation> {
  return (await api.post<{ data: { evaluation: JudgeEvaluation } }>(`${path(eventId, participantId)}/submit`, { scores, confirm: true })).data.data.evaluation
}