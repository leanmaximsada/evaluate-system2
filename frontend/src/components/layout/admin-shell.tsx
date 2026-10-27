'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, LogOut, Menu, UserCircle, Users, X } from 'lucide-react'
import { useAuth } from '@/features/auth/use-auth'
import { FullPageSpinner } from '@/components/ui/spinner'
import { RoleBadge } from '@/components/ui/role-badge'
import { Button } from '@/components/ui/button'

// Add entries here as modules are built. `permission` hides the link for users who lack it.
const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: Users, permission: 'users.manage' },
  { href: '/profile', label: 'Profile', icon: UserCircle },
]
function Breadcrumbs() {
  const pathname = usePathname()
  const parts = pathname.split('/').filter(Boolean)

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
      <ol className="flex items-center gap-2">
        <li>
          <Link href="/dashboard" className="hover:text-slate-700">Home</Link>
        </li>
        {parts.map((part, i) => (
          <li key={i} className="flex items-center gap-2">
            <span aria-hidden="true">/</span>
            <span className={i === parts.length - 1 ? 'font-medium text-slate-900' : ''}>
              {part.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, isLoading, logout, can } = useAuth()
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
    <nav className="space-y-1 p-3" aria-label="Main">
      {NAV.filter((item) => !item.permission || can(item.permission)).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
              active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="px-6 py-5 text-lg font-bold text-indigo-700">Evaluation System</div>
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">
            <div className="flex items-center justify-between px-6 py-5">
              <span className="text-lg font-bold text-indigo-700">Evaluation System</span>
              <button onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <Breadcrumbs />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <RoleBadge role={user.role} />
            </div>
            <Button variant="secondary" onClick={handleLogout}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}