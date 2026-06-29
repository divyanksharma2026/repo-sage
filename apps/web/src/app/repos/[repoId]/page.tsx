'use client'

import { useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useRepo } from '@/hooks/use-repo'
import { useSSE } from '@/hooks/use-sse'
import Link from 'next/link'
import type { SSEProgressEvent } from '@reposage/types'

export default function RepoPage() {
  const { repoId } = useParams<{ repoId: string }>()
  const { repo, loading, error, refetch, setRepo } = useRepo(repoId)
  const refetchedMilestones = useRef<Set<number>>(new Set())

  const isAnalyzing = repo?.status === 'FETCHING' || repo?.status === 'ANALYZING' || repo?.status === 'PENDING'
  const progress = repo?.analysisJob?.progress ?? 0
  const graphReady = repo?.status === 'COMPLETED' || progress >= 85

  useEffect(() => {
    if (!isAnalyzing) return

    const interval = window.setInterval(() => {
      void refetch()
    }, 2000)

    return () => window.clearInterval(interval)
  }, [isAnalyzing, refetch])

  useSSE<SSEProgressEvent>({
    url: `/api/repos/${repoId}/status`,
    enabled: isAnalyzing,
    onMessage: (event) => {
      setRepo((current) => {
        if (!current) return current

        return {
          ...current,
          status: event.status,
          analysisJob: {
            id: current.analysisJob?.id ?? event.jobId,
            repositoryId: event.repositoryId,
            bullJobId: event.jobId,
            progress: event.progress,
            currentStep: event.currentStep,
            errorMessage: event.errorMessage ?? null,
            startedAt: current.analysisJob?.startedAt ?? null,
            completedAt:
              event.status === 'COMPLETED'
                ? new Date().toISOString()
                : current.analysisJob?.completedAt ?? null,
          },
        }
      })

      const shouldRefetch =
        event.status === 'COMPLETED' ||
        event.status === 'FAILED' ||
        [35, 45, 55, 65, 85].includes(event.progress)

      if (shouldRefetch && !refetchedMilestones.current.has(event.progress)) {
        refetchedMilestones.current.add(event.progress)
        void refetch()
      }
    },
  })

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>
  if (error) return <div className="p-8 text-red-500">{error}</div>
  if (!repo) return null

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{repo.fullName}</h1>
          {repo.description && <p className="text-muted-foreground">{repo.description}</p>}
          <div className="flex gap-3 text-sm text-muted-foreground">
            {repo.language && <span>{repo.language}</span>}
            <span>{repo.stars.toLocaleString()} stars</span>
          </div>
        </div>

        {(isAnalyzing || repo.status === 'FAILED') && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {repo.analysisJob?.currentStep ?? 'Queued'}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {repo.analysisJob?.errorMessage && (
              <p className="text-xs text-red-400">{repo.analysisJob.errorMessage}</p>
            )}
          </div>
        )}

        {(repo.status === 'COMPLETED' || repo.architecture || repo.modules.length > 0 || graphReady) && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Architecture', href: `/repos/${repoId}/architecture`, available: Boolean(repo.architecture) },
              { label: 'Modules', href: `/repos/${repoId}/modules`, available: repo.modules.length > 0 },
              { label: 'Files', href: `/repos/${repoId}/files`, available: graphReady },
              { label: 'Graph', href: `/repos/${repoId}/graph`, available: graphReady },
            ].map((tab) =>
              tab.available ? (
                <Link
                  key={tab.label}
                  href={tab.href}
                  className="bg-card border border-border rounded-lg p-4 text-center font-medium hover:border-ring hover:bg-accent transition-colors"
                >
                  {tab.label}
                </Link>
              ) : (
                <div
                  key={tab.label}
                  className="bg-card border border-border rounded-lg p-4 text-center font-medium text-muted-foreground opacity-50"
                >
                  {tab.label}
                </div>
              ),
            )}
          </div>
        )}

        {repo.architecture && (
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Architecture Overview</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{repo.architecture.overview}</p>
            <div className="flex flex-wrap gap-2">
              {(repo.architecture.techStack as string[]).map((tech) => (
                <span key={tech} className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}

        {repo.modules.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Modules</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {repo.modules.map((mod) => (
                <div key={mod.id} className="bg-card border border-border rounded-lg p-4 space-y-1">
                  <h3 className="font-medium text-sm">{mod.name}</h3>
                  <p className="text-xs text-muted-foreground">{mod.path}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{mod.responsibility}</p>
                  <p className="text-xs text-muted-foreground">{mod.fileCount} files</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
