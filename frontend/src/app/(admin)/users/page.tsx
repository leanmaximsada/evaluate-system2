'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { useDebounce } from '@/hooks/use-debounce'
import { useUsers } from '@/features/users/hooks'
import { useI18n } from '@/i18n/provider'
import type { MessageKey } from '@/i18n/messages/en'
import { getErrorMessage } from '@/lib/api'
import type { Role } from '@/types'
import { Card } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'
import { RoleBadge } from '@/components/ui/role-badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { Pagination } from '@/components/ui/pagination'
import { ErrorState } from '@/components/ui/error-state'
import { InlineSpinner } from '@/components/ui/spinner'

const COLUMNS: { key: string; labelKey: MessageKey; sortable: boolean }[] = [
  { key: 'name', labelKey: 'users.col_name', sortable: true },
  { key: 'email', labelKey: 'users.col_email', sortable: true },
  { key: 'role', labelKey: 'users.col_role', sortable: true },
  { key: 'status', labelKey: 'users.col_status', sortable: false },
  { key: 'last_login_at', labelKey: 'users.col_last_signin', sortable: true },
  { key: 'created_at', labelKey: 'users.col_created', sortable: true },
]

const selectClass = 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-indigo-600'

export default function UsersPage() {
  const { t, formatDate, formatDateTime } = useI18n()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'created_at', dir: 'desc' })

  const debouncedSearch = useDebounce(search.trim(), 300)

  const filters = useMemo(
    () => ({ search: debouncedSearch, role, status, page, sort: sort.key, direction: sort.dir }),
    [debouncedSearch, role, status, page, sort],
  )

  const { data, isLoading, isError, error, refetch, isFetching } = useUsers(filters)

  function toggleSort(key: string) {
    setPage(1)
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const hasFilters = !!(debouncedSearch || role || status)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('users.title')}</h1>
        <LinkButton href="/users/new"><Plus className="h-4 w-4" aria-hidden="true" />{t('users.new_user')}</LinkButton>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-56 flex-1">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              aria-label={t('users.search_placeholder')}
              placeholder={t('users.search_placeholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:outline-2 focus:outline-indigo-600"
            />
          </div>
          <select aria-label={t('users.filter_role')} className={selectClass} value={role} onChange={(e) => { setRole(e.target.value as Role | ''); setPage(1) }}>
            <option value="">{t('users.all_roles')}</option>
            <option value="super_admin">{t('role.super_admin')}</option>
            <option value="admin">{t('role.admin')}</option>
            <option value="judge">{t('role.judge')}</option>
          </select>
          <select aria-label={t('users.filter_status')} className={selectClass} value={status} onChange={(e) => { setStatus(e.target.value as '' | 'active' | 'inactive'); setPage(1) }}>
            <option value="">{t('users.all_statuses')}</option>
            <option value="active">{t('common.active')}</option>
            <option value="inactive">{t('common.inactive')}</option>
          </select>
        </div>

        {isLoading ? (
          <InlineSpinner />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : data && data.data.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{hasFilters ? t('users.no_match') : t('users.none')}</p>
        ) : (
          data && (
            <div className="space-y-4">
              <div className={`overflow-x-auto ${isFetching ? 'opacity-70' : ''}`}>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          scope="col"
                          className="px-3 py-2 font-medium"
                          aria-sort={sort.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                        >
                          {col.sortable ? (
                            <button onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 hover:text-slate-900">
                              {t(col.labelKey)}
                              {sort.key === col.key && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />)}
                            </button>
                          ) : (
                            t(col.labelKey)
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.data.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-medium">
                          <Link href={`/users/${u.id}`} className="text-indigo-700 hover:underline">{u.name}</Link>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{u.email}</td>
                        <td className="px-3 py-3"><RoleBadge role={u.role} /></td>
                        <td className="px-3 py-3"><StatusBadge active={u.is_active} /></td>
                        <td className="px-3 py-3 text-slate-600">{u.last_login_at ? formatDateTime(u.last_login_at) : t('common.never')}</td>
                        <td className="px-3 py-3 text-slate-600">{formatDate(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={data.meta} onPage={setPage} disabled={isFetching} />
            </div>
          )
        )}
      </Card>
    </div>
  )
}