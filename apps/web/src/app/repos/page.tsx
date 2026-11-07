'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { RepositoryListItem, User } from '@reposage/types'
import Link from 'next/link'

const statusColor: Record<string, string> = {
  PENDING: 'text-yellow-500',
  FETCHING: 'text-blue-500',
  ANALYZING: 'text-blue-500',
  COMPLETED: 'text-green-500',
  FAILED: 'text-red-500',
}

export default function ReposPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [repos, setRepos] = useState<RepositoryListItem[]>([])
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

  const addRepo = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    setError(null)

    try {
      const { repo } = await api.post<{ repo: RepositoryListItem; reused: boolean }>('/repos', {
        githubUrl: url,
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
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Analyze a repository</h1>
            <p className="text-muted-foreground text-sm">
              Any public GitHub repo. No account needed.
            </p>
          </div>
          {authChecked &&
            (user ? (
              <span className="text-xs text-muted-foreground shrink-0 pt-2">@{user.login}</span>
            ) : (
              <a
                href="/api/auth/github"
                className="text-xs border border-border rounded-lg px-3 py-2 hover:bg-accent transition-colors shrink-0"
              >
                Sign in
              </a>
            ))}
        </div>

        <form onSubmit={addRepo} className="flex gap-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="flex-1 bg-card border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={adding || !url}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Analyze'}
          </button>
        </form>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {authChecked && !user && (
          <p className="text-xs text-muted-foreground">
            Sign in to analyze private repositories and keep a saved list.
          </p>
        )}

        {user && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Saved</h2>
            {repos.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nothing saved yet. Anything you analyze while signed in shows up here.
              </p>
            ) : (
              repos.map((repo) => (
                <Link
                  key={repo.id}
                  href={`/r/${repo.owner}/${repo.name}`}
                  className="block bg-card border border-border rounded-lg p-4 hover:border-ring transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        {repo.fullName}
                        {repo.isPrivate && (
                          <span className="text-[10px] font-normal border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                            private
                          </span>
                        )}
                      </h3>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{repo.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {repo.language && <span>{repo.language}</span>}
                        <span>{repo.stars.toLocaleString()} stars</span>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium shrink-0 ${statusColor[repo.status] ?? 'text-muted-foreground'}`}
                    >
                      {repo.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
