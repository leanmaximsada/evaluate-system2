'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Gear, List, SignOut, SquaresFour, Trophy, UserCircle, Users, X, type Icon } from '@phosphor-icons/react'
import { useAuth } from '@/features/auth/use-auth'
import { useI18n } from '@/i18n/provider'
import type { MessageKey } from '@/i18n/messages/en'
import { FullPageSpinner } from '@/components/ui/spinner'
import { RoleBadge } from '@/components/ui/role-badge'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/ui/language-switcher'

interface NavItem { href: string; labelKey: MessageKey; icon: Icon; permission?: string }

// Add entries here as modules are built. `permission` hides the link for users who lack it.
const SECTIONS: { labelKey: MessageKey; items: NavItem[] }[] = [
  { labelKey: 'nav.section_overview', items: [{ href: '/dashboard', labelKey: 'nav.dashboard', icon: SquaresFour }] },
  {
    labelKey: 'nav.section_admin',
    items: [
      { href: '/users', labelKey: 'nav.users', icon: Users, permission: 'users.manage' },
      { href: '/settings', labelKey: 'nav.settings', icon: Gear, permission: 'settings.manage' },
    ],
  },
  { labelKey: 'nav.section_account', items: [{ href: '/profile', labelKey: 'nav.profile', icon: UserCircle }] },
]

const SEGMENTS: Record<string, MessageKey> = {
  dashboard: 'nav.dashboard',
  users: 'nav.users',
  settings: 'nav.settings',
  profile: 'nav.profile',
  forbidden: 'forbidden.title',
  new: 'common.new',
  edit: 'common.edit',
}

function Brand() {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
        <Trophy weight="fill" className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="text-base font-semibold tracking-tight text-slate-900">{t('app.name')}</span>
    </div>
  )
}

function Breadcrumbs() {
  const pathname = usePathname()
  const { t } = useI18n()
  const parts = pathname.split('/').filter(Boolean)

  return (
    <nav aria-label={t('nav.breadcrumb')} className="text-sm text-slate-500">
      <ol className="flex items-center gap-2">
        <li><Link href="/dashboard" className="hover:text-slate-900">{t('nav.home')}</Link></li>
        {parts.map((part, i) => (
          <li key={i} className="flex items-center gap-2">
            <span aria-hidden="true">/</span>
            <span className={i === parts.length - 1 ? 'font-medium text-slate-900' : ''}>
              {SEGMENTS[part] ? t(SEGMENTS[part]) : part}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, isLoading, logout, can } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login')
  }, [isLoading, user, router])

  useEffect(() => setOpen(false), [pathname])

  if (isLoading || !user) return <FullPageSpinner />

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label={t('nav.main')}>
      {SECTIONS.map((section, index) => {
        const items = section.items.filter((item) => !item.permission || can(item.permission))
        if (items.length === 0) return null

        return (
          <div key={section.labelKey} className={index > 0 ? 'mt-3 border-t border-slate-100 pt-3' : ''}>
            <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{t(section.labelKey)}</p>
            <ul className="space-y-1">
              {items.map(({ href, labelKey, icon: NavIcon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <NavIcon weight={active ? 'fill' : 'regular'} className="h-[18px] w-[18px]" aria-hidden="true" />
                      {t(labelKey)}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-5 py-5"><Brand /></div>
        {nav}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-5">
              <Brand />
              <button onClick={() => setOpen(false)} aria-label={t('nav.close_menu')} className="rounded-md p-1 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-md p-1 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label={t('nav.open_menu')}>
              <List className="h-5 w-5" />
            </button>
            <p className="hidden text-sm text-slate-600 sm:block">
              {t('shell.signed_in_as')} <span className="font-medium text-slate-900">{user.email}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <RoleBadge role={user.role} />
            <Button variant="secondary" onClick={handleLogout}>
              <SignOut className="h-4 w-4" aria-hidden="true" />
              {t('shell.sign_out')}
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}