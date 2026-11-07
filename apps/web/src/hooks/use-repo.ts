'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { Repository, Architecture, Module, AnalysisJob } from '@reposage/types'

export interface RepoDetail extends Repository {
  architecture: Architecture | null
  modules: Module[]
  analysisJob: AnalysisJob | null
}

/**
 * Loads the repository for the current /r/<owner>/<name> route.
 *
 * Pages address repositories by owner/name so a link is shareable, but the
 * sub-resource endpoints (graph, files, chat) still take the internal id —
 * so `repoId` is handed back here and is null until the resolve lands.
 */
export function useRepoRoute() {
  const { owner, name } = useParams<{ owner: string; name: string }>()
  const [repo, setRepo] = useState<RepoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRepo = useCallback(async () => {
    if (!owner || !name) return
    try {
      const data = await api.get<{ repo: RepoDetail }>(
        `/repos/by/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
      )
      setRepo(data.repo)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repository')
    } finally {
      setLoading(false)
    }
  }, [owner, name])

  useEffect(() => {
    void fetchRepo()
  }, [fetchRepo])

  return {
    repo,
    repoId: repo?.id ?? null,
    owner,
    name,
    loading,
    error,
    refetch: fetchRepo,
    setRepo,
  }
}
