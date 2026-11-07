import { CheckCircle2, CircleDashed, Loader2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { AnalysisStatus } from '@reposage/types'

/** One mapping for the status enum, so no page invents its own colours. */
const STATUS = {
  PENDING: { label: 'Queued', variant: 'outline', Icon: CircleDashed, spin: false },
  FETCHING: { label: 'Fetching', variant: 'primary', Icon: Loader2, spin: true },
  ANALYZING: { label: 'Analyzing', variant: 'primary', Icon: Loader2, spin: true },
  COMPLETED: { label: 'Ready', variant: 'success', Icon: CheckCircle2, spin: false },
  FAILED: { label: 'Failed', variant: 'danger', Icon: XCircle, spin: false },
} as const

export function StatusBadge({ status }: { status: AnalysisStatus }) {
  const s = STATUS[status] ?? STATUS.PENDING
  return (
    <Badge variant={s.variant}>
      <s.Icon className={s.spin ? 'animate-spin' : undefined} />
      {s.label}
    </Badge>
  )
}
