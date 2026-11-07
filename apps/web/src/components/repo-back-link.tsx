'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/**
 * Back to the repository overview.
 *
 * Reads owner/name straight from the route rather than from `useRepoRoute`, so
 * it renders immediately — sub-pages must stay navigable while the
 * owner/name → id resolve is still in flight, or a loading or failed page
 * becomes a dead end.
 */
export function RepoBackLink({ className = '' }: { className?: string }) {
  const { owner, name } = useParams<{ owner: string; name: string }>()

  return (
    <Link
      href={`/r/${owner}/${name}`}
      className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground ${className}`}
    >
      <ArrowLeft className="size-3.5" />
      <span className="truncate font-mono text-xs">
        {owner}/{name}
      </span>
    </Link>
  )
}
