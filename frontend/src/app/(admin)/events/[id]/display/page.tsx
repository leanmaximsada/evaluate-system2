'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowSquareOut, CheckCircle, Info, Megaphone, WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '@/features/auth/use-auth'
import { eventKeys, useEvent } from '@/features/events/hooks'
import { removeOrganizationLogo, saveDisplaySettings, uploadOrganizationLogo, type DisplaySettingsInput } from '@/features/display/api'
import { useDisplayPreview } from '@/features/display/hooks'
import { DisplaySettingsForm } from '@/features/display/display-settings-form'
import { PreviewFrame, type PreviewMode } from '@/features/display/preview-frame'
import { SponsorsManager } from '@/features/sponsors/sponsors-manager'
import { publishResults, type PublishPayload } from '@/features/results/api'
import { resultKeys } from '@/features/results/hooks'
import { PublishDialog } from '@/features/results/publish-dialog'
import { useI18n } from '@/i18n/provider'
import type { MessageKey } from '@/i18n/messages/en'
import { getErrorMessage, getErrorMessages } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

type Level = 'ok' | 'warn' | 'info'
const icon = { ok: CheckCircle, warn: WarningCircle, info: Info }
const iconTone = { ok: 'text-green-600', warn: 'text-amber-600', info: 'text-slate-400' }

export default function DisplayReviewPage() {
  const { t } = useI18n()
  const { can } = useAuth()
  const eventId = Number(useParams<{ id: string }>().id)
  const queryClient = useQueryClient()

  const { data: event } = useEvent(eventId)
  const preview = useDisplayPreview(eventId)

  const [version, setVersion] = useState(0)
  const [mode, setMode] = useState<PreviewMode>('projector')
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishErrors, setPublishErrors] = useState<string[] | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: eventKeys.all })
    queryClient.invalidateQueries({ queryKey: resultKeys.all })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    setVersion((v) => v + 1)
  }

  const save = useMutation({ mutationFn: (input: DisplaySettingsInput) => saveDisplaySettings(eventId, input), onSuccess: refresh })
  const upload = useMutation({ mutationFn: (file: File) => uploadOrganizationLogo(eventId, file), onSuccess: refresh })
  const removeLogo = useMutation({ mutationFn: () => removeOrganizationLogo(eventId), onSuccess: refresh })
  const publish = useMutation({
    mutationFn: (payload: PublishPayload) => publishResults(eventId, payload),
    onSuccess: () => { setPublishOpen(false); setPublishErrors(null); setFeedback(t('display.published_ok')); refresh() },
    onError: (e) => setPublishErrors(getErrorMessages(e)),
  })

  if (!event) return null

  const checks = preview.data?.checks
  const items: { level: Level; text: string }[] = checks ? [
    { level: checks.event_completed ? 'ok' : 'warn', text: t(checks.event_completed ? 'display.check_completed_ok' : 'display.check_completed_no') },
    { level: checks.ranked_participants > 0 ? 'ok' : 'warn', text: checks.ranked_participants > 0 ? t('display.check_ranked_ok', { n: checks.ranked_participants }) : t('display.check_ranked_no') },
    { level: checks.incomplete_evaluations === 0 ? 'ok' : 'warn', text: checks.incomplete_evaluations === 0 ? t('display.check_incomplete_ok') : t('display.check_incomplete_no', { n: checks.incomplete_evaluations }) },
    { level: checks.has_organization ? 'ok' : 'info', text: t(checks.has_organization ? 'display.check_org_ok' : 'display.check_org_no') },
    { level: checks.sponsors_count > 0 ? 'ok' : 'info', text: checks.sponsors_count > 0 ? t('display.check_sponsors_ok', { n: checks.sponsors_count }) : t('display.check_sponsors_no') },
    { level: checks.has_subtitle ? 'ok' : 'info', text: t(checks.has_subtitle ? 'display.check_subtitle_ok' : 'display.check_subtitle_no') },
    ...(checks.is_published ? [{ level: 'info' as const, text: t('display.check_published') }] : []),
  ] : []

  const canPublishNow = can('results.publish') && !!checks?.event_completed && !checks.is_published
  const src = `/live/${encodeURIComponent(event.code)}?preview=1&event=${event.id}`

  return (
    <div className="max-w-5xl space-y-6">
      {feedback && <Alert kind="success">{feedback}</Alert>}

      <Card title={t('display.checklist')}>
        {preview.isLoading ? (
          <InlineSpinner />
        ) : preview.isError ? (
          <ErrorState message={getErrorMessage(preview.error)} onRetry={() => preview.refetch()} />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const Icon = icon[item.level]
              return (
                <li key={item.text} className="flex items-start gap-3 text-sm text-slate-700">
                  <Icon weight="fill" className={`mt-0.5 h-5 w-5 shrink-0 ${iconTone[item.level]}`} aria-hidden="true" />
                  <span>{item.text}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card
        title={t('display.preview')}
        description={t('display.preview_hint')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {(['projector', 'phone'] as const).map((m) => (
              <Button key={m} variant={mode === m ? 'primary' : 'secondary'} aria-pressed={mode === m} onClick={() => setMode(m)}>
                {t(`display.mode_${m}` as MessageKey)}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => setVersion((v) => v + 1)}>{t('display.refresh')}</Button>
          </div>
        }
      >
        <PreviewFrame key={version} src={src} mode={mode} title={t('display.preview')} />
      </Card>

      <Card title={t('display.publish_card')} description={t('display.publish_hint')}>
        <div className="flex flex-wrap items-center gap-3">
          {canPublishNow && (
            <Button onClick={() => setPublishOpen(true)}><Megaphone className="h-4 w-4" aria-hidden="true" />{t('results.publish')}</Button>
          )}
          {checks?.is_published && (
            <Link href={`/live/${event.code}`} target="_blank" className="inline-flex items-center gap-2 text-sm font-medium text-slate-900 underline">
              <ArrowSquareOut className="h-4 w-4" aria-hidden="true" />{t('display.open')}
            </Link>
          )}
          {!canPublishNow && !checks?.is_published && <p className="text-sm text-slate-500">{t('results.publish_after_complete')}</p>}
        </div>
        <p className="mt-3 text-xs text-slate-500">{t('display.live_note')}</p>
      </Card>

      <Card title={t('display.settings')} description={t('display.settings_hint')}>
        <DisplaySettingsForm
          event={event}
          onSave={(input) => save.mutateAsync(input)}
          onUploadLogo={(file) => upload.mutateAsync(file)}
          onRemoveLogo={() => removeLogo.mutateAsync()}
        />
      </Card>

      <SponsorsManager eventId={eventId} onChanged={() => setVersion((v) => v + 1)} />

      {publishOpen && (
        <PublishDialog
          open
          hasPrevious={checks?.has_previous_publication ?? false}
          incompleteCount={checks?.incomplete_evaluations ?? 0}
          defaultVisibility={event.display_visibility}
          loading={publish.isPending}
          errors={publishErrors}
          onSubmit={(payload) => publish.mutate(payload)}
          onClose={() => { setPublishOpen(false); setPublishErrors(null) }}
        />
      )}
    </div>
  )
}