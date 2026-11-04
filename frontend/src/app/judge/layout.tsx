import type { ReactNode } from 'react'
import { JudgeShell } from '@/components/layout/judge-shell'

export default function JudgeLayout({ children }: { children: ReactNode }) {
  return <JudgeShell>{children}</JudgeShell>
}