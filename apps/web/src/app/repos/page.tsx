'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import type { RepositoryListItem } from '@reposage/types'
import Link from 'next/link'

export default function ReposPage() {
  const [repos, setRepos] = useState<RepositoryListItem[]>([])
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRepos = async () => {
    const data = await api.get<{ repos: RepositoryListItem[] }>('/repos')
    setRepos(data.repos)
  }

  useEffect(() => { void fetchRepos() }, [])

  const addRepo = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    setError(null)
    try {
      const { repo } = await api.post<{ repo: RepositoryListItem }>('/repos', { githubUrl: url })
      await api.post(`/repos/${repo.id}/analyze`)
      setUrl('')
      await fetchRepos()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repository')
    } finally {
      setAdding(false)
    }
  }

  const statusColor: Record<string, string> = {
    PENDING: 'text-yellow-500',
    FETCHING: 'text-blue-500',
    ANALYZING: 'text-blue-500',
    COMPLETED: 'text-green-500',
    FAILED: 'text-red-500',
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Repositories</h1>
          <p className="text-muted-foreground">Analyze any public or private GitHub repository</p>
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

        <div className="space-y-3">
          {repos.map((repo) => (
            <Link
              key={repo.id}
              href={`/repos/${repo.id}`}
              className="block bg-card border border-border rounded-lg p-4 hover:border-ring transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h2 className="font-semibold text-sm">{repo.fullName}</h2>
                  {repo.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{repo.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {repo.language && <span>{repo.language}</span>}
                    <span>{repo.stars.toLocaleString()} stars</span>
                  </div>
                </div>
                <span className={`text-xs font-medium ${statusColor[repo.status] ?? 'text-muted-foreground'}`}>
                  {repo.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
