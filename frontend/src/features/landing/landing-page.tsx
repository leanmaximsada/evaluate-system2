'use client'

import Link from 'next/link'
import {
  ArrowRight, Broadcast, ChartBar, ClipboardText, DeviceMobile, Eye, Gavel, Megaphone, Translate, Trophy, UsersThree,
  type Icon,
} from '@phosphor-icons/react'
import { useAuth } from '@/features/auth/use-auth'
import { useI18n } from '@/i18n/provider'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { LinkButton } from '@/components/ui/link-button'
import { ThemeToggle } from '@/theme/theme-toggle'
import { Screenshot } from './screenshot'
import { Logo } from '@/components/ui/logo'

const FEATURES: { id: 'forms' | 'judge' | 'results' | 'display' | 'reveal' | 'bilingual'; icon: Icon }[] = [
  { id: 'forms', icon: ClipboardText },
  { id: 'judge', icon: DeviceMobile },
  { id: 'results', icon: ChartBar },
  { id: 'display', icon: Eye },
  { id: 'reveal', icon: Broadcast },
  { id: 'bilingual', icon: Translate },
]

const STEPS = ['setup', 'score', 'review', 'publish'] as const

const ROLES: { id: 'admin' | 'judge' | 'audience'; icon: Icon }[] = [
  { id: 'admin', icon: Gavel },
  { id: 'judge', icon: ClipboardText },
  { id: 'audience', icon: UsersThree },
]

const SHOTS: { id: 'dashboard' | 'results' | 'display' | 'public' | 'judge'; src: string; phone?: boolean }[] = [
  { id: 'dashboard', src: '/screenshots/dashboard.png' },
  { id: 'results', src: '/screenshots/results.png' },
  { id: 'display', src: '/screenshots/display-review.png' },
  { id: 'public', src: '/screenshots/public-screen.png' },
  { id: 'judge', src: '/screenshots/judge.png', phone: true },
]

export function LandingPage() {
  const { t } = useI18n()
  const { user } = useAuth()

  const entry = user
    ? { href: user.role === 'judge' ? '/judge' : '/dashboard', label: t('landing.open_app') }
    : { href: '/login', label: t('landing.sign_in') }

  return (
    <div className="min-h-screen scroll-smooth bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
          <Logo />
            <span className="font-semibold tracking-tight">{t('app.name2')}</span>
          </Link>

          <nav aria-label={t('landing.nav_label')} className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">{t('landing.nav_features')}</a>
            <a href="#how" className="hover:text-slate-900">{t('landing.nav_how')}</a>
            <a href="#screens" className="hover:text-slate-900">{t('landing.nav_screens')}</a>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <LinkButton href={entry.href}>{entry.label}</LinkButton>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-1 text-sm font-medium text-slate-600">
              {t('landing.badge')}
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{t('landing.hero_title')}</h1>
            <p className="mt-5 text-lg text-slate-600">{t('landing.hero_text')}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <LinkButton href={entry.href}>
                {entry.label}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </LinkButton>
              <a
                href="#how"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                {t('landing.cta_secondary')}
              </a>
            </div>
          </div>

          <div className="mx-auto mt-14 max-w-5xl">
            <Screenshot src="/screenshots/public-screen.png" alt={t('landing.shot_public')} priority />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">{t('landing.features_title')}</h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ id, icon: FeatureIcon }) => (
                <li key={id} className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                    <FeatureIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{t(`landing.f_${id}_title`)}</h3>
                  <p className="mt-2 text-sm text-slate-600">{t(`landing.f_${id}_text`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">{t('landing.how_title')}</h2>
            <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((id, index) => (
                <li key={id} className="rounded-xl border border-slate-200 bg-white p-6">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-sm font-semibold text-slate-700">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{t(`landing.s_${id}_title`)}</h3>
                  <p className="mt-2 text-sm text-slate-600">{t(`landing.s_${id}_text`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Screenshots */}
        <section id="screens" className="scroll-mt-20 border-t border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">{t('landing.screens_title')}</h2>
            <p className="mt-3 text-center text-slate-600">{t('landing.screens_text')}</p>

            <div className="mt-10 grid items-start gap-8 md:grid-cols-2">
              {SHOTS.map(({ id, src, phone }) => (
                <figure key={id} className={phone ? 'md:col-span-2' : undefined}>
                  <Screenshot src={src} alt={t(`landing.shot_${id}`)} phone={phone} />
                  <figcaption className="mt-3 text-center text-sm font-medium text-slate-600">{t(`landing.shot_${id}`)}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Audiences */}
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">{t('landing.roles_title')}</h2>
            <ul className="mt-10 grid gap-5 md:grid-cols-3">
              {ROLES.map(({ id, icon: RoleIcon }) => (
                <li key={id} className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                    <RoleIcon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{t(`landing.r_${id}_title`)}</h3>
                  <p className="mt-2 text-sm text-slate-600">{t(`landing.r_${id}_text`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Final call to action */}
        <section className="border-t border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Megaphone className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">{t('landing.cta_title')}</h2>
            <p className="mt-3 text-slate-600">{t('landing.cta_text')}</p>
            <div className="mt-6">
              <LinkButton href={entry.href}>
                {entry.label}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </LinkButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-sm text-slate-500 sm:px-6">
          <span className="font-medium text-slate-700">{t('app.name')}</span>
          <span>{t('landing.footer_note')}</span>
        </div>
      </footer>
    </div>
  )
}