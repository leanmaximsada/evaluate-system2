import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <p className="text-5xl font-bold text-red-600">403</p>
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="text-slate-600">You do not have permission to view this page.</p>
      <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:underline">
        Back to dashboard
      </Link>
    </div>
  )
}