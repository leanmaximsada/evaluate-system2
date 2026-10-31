import Link from 'next/link'
import type { ReactNode } from 'react'
import { buttonClass } from './button'

export function LinkButton({
  href,
  children,
  variant = 'primary',
}: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary'
}) {
  return <Link href={href} className={buttonClass(variant)}>{children}</Link>
}