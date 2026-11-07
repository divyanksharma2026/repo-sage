'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

/**
 * Back to the repository overview.
 *
 * Reads owner/name straight from the route rather than from `useRepoRoute`, so
 * it renders immediately — sub-pages must stay navigable while the
 * owner/name → id resolve is still in flight, or an empty/failed page becomes
 * a dead end.
 */
export function RepoBackLink({ className = '' }: { className?: string }) {
  const { owner, name } = useParams<{ owner: string; name: string }>()

  return (
    <Link
      href={`/r/${owner}/${name}`}
      className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <span aria-hidden>←</span>
      <span className="font-mono text-xs truncate">
        {owner}/{name}
      </span>
    </Link>
  )
}
