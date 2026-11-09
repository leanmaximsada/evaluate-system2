export type Role = 'super_admin' | 'admin' | 'judge'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  is_active: boolean
  permissions: string[]
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface Paginated<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
    from: number | null
    to: number | null
  }
}

export interface SettingsData {
  general: {
    system_name: string
    default_language: 'en' | 'km'
    timezone: string
    date_format: 'Y-m-d' | 'd/m/Y' | 'm/d/Y' | 'd M Y'
    time_format: '24h' | '12h'
    pagination_size: number
  }
  evaluation: {
    min_score: number
    max_score: number
    score_precision: number
    tie_policy: 'standard' | 'dense'
    show_tie_indicator: boolean
    live_provisional_enabled: boolean
    default_result_visibility: 'rank_and_score' | 'rank_only' | 'hidden'
  }
}

export interface SystemInfo {
  environment: string
  debug: boolean
  php_version: string
  laravel_version: string
  database_driver: string
  queue_driver: string
  broadcast_driver: string
  timezone: string
}

export type EventStatus = 'draft' | 'upcoming' | 'in_progress' | 'completed' | 'cancelled'

export interface EventItem {
  id: number
  name: string
  code: string
  description: string | null
  venue: string | null
  category: string | null
  public_subtitle: string | null
  timezone: string
  starts_at: string
  ends_at: string
  starts_at_local: string
  ends_at_local: string
  status: EventStatus
  evaluation_form_version_id: number | null
  form?: { id: number; name: string | null; version_id: number; version_number: number } | null
  allowed_transitions: EventStatus[]
  is_closed: boolean
  is_structure_locked: boolean
  participants_count?: number
  judges_count?: number
  created_by?: string | null
  created_at: string
  updated_at: string
  organization_name: string | null
  organization_logo_url: string | null
  display_visibility: PublicVisibility
  is_published?: boolean
}

export type FormStatus = 'draft' | 'active' | 'inactive'

export interface Criterion {
  id: number
  name: string
  description: string | null
  min_score: number
  max_score: number
  weight: number
  display_order: number
  is_required: boolean
  is_active: boolean
}

export interface FormVersionSummary {
  id: number
  evaluation_form_id: number
  version_number: number
  status: 'draft' | 'published'
  is_weighted: boolean
  published_at: string | null
  criteria_count?: number
}

export interface FormVersion extends FormVersionSummary {
  criteria: Criterion[]
  weight_total: number
  publish_issues?: string[]
}

export interface EvaluationForm {
  id: number
  name: string
  description: string | null
  status: FormStatus
  latest_published_version: number | null
  has_draft: boolean
  versions_count: number
  versions: FormVersionSummary[]
  created_by?: string | null
  created_at: string
  updated_at: string
}

export type ParticipantStatus = 'registered' | 'withdrawn' | 'disqualified'

export interface Participant {
  id: number
  event_id: number
  name: string
  number: string
  team_name: string | null
  description: string | null
  presentation_order: number | null
  status: ParticipantStatus
}

export interface Judge {
  id: number
  name: string
  email: string
  assigned_at: string | null
}

export interface DashboardData {
  users: { total: number; active: number; admins: number; judges: number } | null
  events: {
    awaiting_review: number
    total: number
    by_status: Record<EventStatus, number>
    participants: number
    judges: number
    evaluations: { expected: number; submitted: number }
    recent: { id: number; name: string; code: string; status: EventStatus; updated_at: string }[]
  } | null
  activity: { id: number; action: string; actor: string | null; created_at: string }[] | null
}

export type EvaluationState = 'complete' | 'partial' | 'none'
export type PublicVisibility = 'rank_and_score' | 'rank_only'

export interface ResultRow {
  participant_id: number
  number: string
  name: string
  team_name: string | null
  participant_status: ParticipantStatus
  presentation_order: number
  aggregate_score: string | null
  rank: number | null
  is_tied: boolean
  judges_assigned: number
  evaluations_submitted: number
  is_complete: boolean
  evaluation_status: EvaluationState
  calculated_at: string | null
}

export interface PublicationSummary {
  status: 'none' | 'published' | 'unpublished'
  revision: number | null
  visibility: PublicVisibility | null
  is_final: boolean
  published_at: string | null
  published_by: string | null
  unpublished_at: string | null
  needs_republish: boolean
}

export interface ResultsOverview {
  event: { id: number; name: string; code: string; status: EventStatus }
  is_provisional: boolean
  summary: {
    participants: number
    judges_assigned: number
    evaluations_expected: number
    evaluations_submitted: number
    completion_percent: number
  }
  publication: PublicationSummary
  rows: ResultRow[]
}

export interface Publication {
  revision: number
  status: 'published' | 'unpublished'
  visibility: PublicVisibility | null
  is_final: boolean
  published_at: string | null
  published_by?: string
  unpublished_at?: string
  correction_reason?: string
  rows_count: number
  rows?: { number: string; name: string; team_name: string | null; rank: number; tied: boolean; score?: string }[]
}

export interface JudgeScore {
  criterion_id: number
  name: string
  min_score: number
  max_score: number
  weight: number
  score: string | null
}

export interface JudgeRevision {
  revision: number
  changed_by: string | null
  reason: string | null
  previous_total: string | null
  created_at: string
}

export interface JudgeResult {
  judge: { id: number; name: string; email: string }
  status: 'not_started' | 'draft' | 'submitted'
  submitted_at: string | null
  total_score: string | null
  revision: number | null
  scores: JudgeScore[]
  revisions: JudgeRevision[]
}

export interface ParticipantDetail {
  participant: { id: number; number: string; name: string; team_name: string | null; status: ParticipantStatus }
  result: {
    aggregate_score: string | null
    rank: number | null
    is_tied: boolean
    evaluations_submitted: number
    judges_assigned: number
    is_complete: boolean
    calculated_at: string | null
  } | null
  judges: JudgeResult[]
}

export type JudgeEvaluationStatus = 'not_started' | 'draft' | 'submitted'

export interface JudgeEventSummary {
  id: number
  name: string
  code: string
  venue: string | null
  starts_at_local: string | null
  participants_total: number
  submitted: number
  drafts: number
}

export interface JudgeParticipantItem {
  id: number
  number: string
  name: string
  team_name: string | null
  presentation_order: number
  evaluation_status: JudgeEvaluationStatus
  total_score: string | null
}

export interface JudgeEventDetail {
  event: { id: number; name: string; code: string; description: string | null; venue: string | null }
  is_weighted: boolean
  criteria: Criterion[]
  participants: JudgeParticipantItem[]
}

export interface JudgeEvaluation {
  status: JudgeEvaluationStatus
  scores: Record<string, string>
  total_score: string | null
  submitted_at: string | null
  revision: number | null
}

export interface JudgeParticipantDetail {
  event: { id: number; name: string; code: string }
  participant: { id: number; number: string; name: string; team_name: string | null; description: string | null }
  is_weighted: boolean
  criteria: Criterion[]
  evaluation: JudgeEvaluation
}

export type SponsorTier = 'diamond' | 'gold' | 'silver' | 'supporter'

export interface Sponsor {
  id: number
  name: string
  tier: SponsorTier
  logo_url: string
  display_order: number
}

export interface PublicSponsor {
  tier: SponsorTier
  name: string
  logo_url: string
}

export interface DisplayChecks {
  event_completed: boolean
  ranked_participants: number
  incomplete_evaluations: number
  sponsors_count: number
  has_organization: boolean
  has_organization_logo: boolean
  has_subtitle: boolean
  is_published: boolean
  has_previous_publication: boolean
}