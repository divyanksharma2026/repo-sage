'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import type { Repository, Architecture, Module, AnalysisJob } from '@reposage/types'

interface RepoDetail extends Repository {
  architecture: Architecture | null
  modules: Module[]
  analysisJob: AnalysisJob | null
}

export function useRepo(repoId: string) {
  const [repo, setRepo] = useState<RepoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRepo = async () => {
    try {
      const data = await api.get<{ repo: RepoDetail }>(`/repos/${repoId}`)
      setRepo(data.repo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repository')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchRepo()
  }, [repoId])

  return { repo, loading, error, refetch: fetchRepo }
}
