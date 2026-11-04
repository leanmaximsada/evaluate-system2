'use client'

import { useI18n } from '@/i18n/provider'
import type { MessageKey } from '@/i18n/messages/en'
import type { ConnectionState } from './use-realtime'

const label: Record<ConnectionState, MessageKey> = {
  connected: 'live.status_connected',
  connecting: 'live.status_connecting',
  offline: 'live.status_offline',
  disabled: 'live.status_disabled',
}
const dot: Record<ConnectionState, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-amber-400',
  offline: 'bg-red-500',
  disabled: 'bg-slate-400',
}

export function LiveIndicator({ state, dark = false }: { state: ConnectionState; dark?: boolean }) {
  const { t } = useI18n()

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${dark ? 'bg-white/10 text-slate-200' : 'bg-slate-100 text-slate-700'}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot[state]}`} aria-hidden="true" />
      {t(label[state])}
    </span>
  )
}