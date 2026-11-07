'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  Github,
  Loader2,
  Lock,
  Search,
  Star,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import { PageShell, PageHeading } from '@/components/page-shell'
import type { RepositoryListItem, User } from '@reposage/types'

export default function ReposPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [repos, setRepos] = useState<RepositoryListItem[] | null>(null)
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ user: User }>('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true))
  }, [])

  // The saved list is the one thing here that genuinely needs an account.
  useEffect(() => {
    if (!user) return
    api
      .get<{ repos: RepositoryListItem[] }>('/repos')
      .then((d) => setRepos(d.repos))
      .catch(() => setRepos([]))
  }, [user])

  const addRepo = useCallback(
    async (githubUrl: string) => {
      if (!githubUrl.trim()) return
      setAdding(true)
      setError(null)

      try {
        const { repo } = await api.post<{ repo: RepositoryListItem; reused: boolean }>('/repos', {
          githubUrl: githubUrl.trim(),
        })

        // An already-analyzed repo is served straight from the shared result —
        // the second person to ask for a popular repo pays nothing.
        if (repo.status === 'PENDING' || repo.status === 'FAILED') {
          await api.post(`/repos/${repo.id}/analyze`)
        }

        setUrl('')
        router.push(`/r/${repo.owner}/${repo.name}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add repository')
      } finally {
        setAdding(false)
      }
    },
    [router],
  )

  // Handed over from the landing page's input. Read from location rather than
  // useSearchParams so the page needs no Suspense boundary.
  useEffect(() => {
    const handed = new URLSearchParams(window.location.search).get('url')
    if (!handed) return
    window.history.replaceState(null, '', '/repos')
    setUrl(handed)
    void addRepo(handed)
  }, [addRepo])

  return (
    <PageShell>
      <div className="space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Home
        </Link>

        <PageHeading
          title="Analyze a repository"
          description="Any public GitHub repo. No account needed."
          actions={
            authChecked &&
            (user ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                <Github className="size-3.5" />@{user.login}
              </span>
            ) : (
              <a href="/api/auth/github" className="shrink-0">
                <Button variant="outline" size="sm">
                  <Github />
                  Sign in
                </Button>
              </a>
            ))
          }
        />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void addRepo(url)
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <Github className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="github.com/owner/repo"
              aria-label="GitHub repository URL"
              disabled={adding}
              className="h-10 pl-9"
            />
          </div>
          <Button type="submit" size="lg" disabled={adding || !url.trim()}>
            {adding ? <Loader2 className="animate-spin" /> : <Search />}
            {adding ? 'Analyzing…' : 'Analyze'}
          </Button>
        </form>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {authChecked && !user && (
          <p className="text-sm text-muted-foreground">
            Sign in to analyze private repositories and keep a saved list.
          </p>
        )}

        {user && (
          <section className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Saved
            </h2>

            {repos === null ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-[86px] w-full" />
                ))}
              </div>
            ) : repos.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Nothing saved yet"
                description="Anything you analyze while signed in shows up here."
              />
            ) : (
              <div className="space-y-2">
                {repos.map((repo) => (
                  <Link key={repo.id} href={`/r/${repo.owner}/${repo.name}`} className="block">
                    <Card interactive className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-semibold">{repo.fullName}</h3>
                            {repo.isPrivate && (
                              <Lock className="size-3 shrink-0 text-muted-foreground" />
                            )}
                          </div>
                          {repo.description && (
                            <p className="line-clamp-1 text-sm text-muted-foreground">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {repo.language && <span>{repo.language}</span>}
                            <span className="inline-flex items-center gap-1">
                              <Star className="size-3" />
                              {repo.stars.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={repo.status} />
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </PageShell>
  )
}
