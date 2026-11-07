'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  Blocks,
  Boxes,
  ExternalLink,
  FileCode2,
  Loader2,
  Lock,
  MessageSquareQuote,
  Network,
  Star,
} from 'lucide-react'
import { useRepoRoute } from '@/hooks/use-repo'
import { useSSE } from '@/hooks/use-sse'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { PageShell } from '@/components/page-shell'
import { cn } from '@/lib/utils'
import type { SSEProgressEvent } from '@reposage/types'

function BackToList() {
  return (
    <Link
      href="/repos"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      All repositories
    </Link>
  )
}

export default function RepoPage() {
  const { repo, repoId, owner, name, loading, error, refetch, setRepo } = useRepoRoute()
  const base = `/r/${owner}/${name}`
  const refetchedMilestones = useRef<Set<number>>(new Set())

  const isAnalyzing =
    repo?.status === 'FETCHING' || repo?.status === 'ANALYZING' || repo?.status === 'PENDING'
  const progress = repo?.analysisJob?.progress ?? 0
  const graphReady = repo?.status === 'COMPLETED' || progress >= 85
  // The search index is the last stage before completion (see orchestrator).
  const chatReady = repo?.status === 'COMPLETED' || progress >= 97

  useEffect(() => {
    if (!isAnalyzing) return
    const interval = window.setInterval(() => void refetch(), 2000)
    return () => window.clearInterval(interval)
  }, [isAnalyzing, refetch])

  useSSE<SSEProgressEvent>({
    url: `/api/repos/${repoId}/status`,
    enabled: isAnalyzing && repoId !== null,
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
        [35, 45, 55, 65, 85, 97].includes(event.progress)

      if (shouldRefetch && !refetchedMilestones.current.has(event.progress)) {
        refetchedMilestones.current.add(event.progress)
        void refetch()
      }
    },
  })

  if (loading || error || !repo) {
    return (
      <PageShell width="wide">
        <div className="space-y-6">
          <BackToList />
          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : loading ? (
            <div className="space-y-6">
              <Skeleton className="h-9 w-72" />
              <Skeleton className="h-4 w-96" />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load this repository.</p>
          )}
        </div>
      </PageShell>
    )
  }

  const tabs = [
    {
      label: 'Architecture',
      href: `${base}/architecture`,
      icon: Blocks,
      available: Boolean(repo.architecture),
    },
    { label: 'Modules', href: `${base}/modules`, icon: Boxes, available: repo.modules.length > 0 },
    { label: 'Files', href: `${base}/files`, icon: FileCode2, available: graphReady },
    { label: 'Graph', href: `${base}/graph`, icon: Network, available: graphReady },
    { label: 'Ask', href: `${base}/chat`, icon: MessageSquareQuote, available: chatReady },
  ]

  return (
    <PageShell width="wide">
      <div className="space-y-8">
        <BackToList />

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{repo.fullName}</h1>
              {repo.isPrivate && (
                <Badge variant="outline">
                  <Lock />
                  Private
                </Badge>
              )}
              <StatusBadge status={repo.status} />
            </div>

            {repo.description && (
              <p className="max-w-2xl text-sm text-muted-foreground">{repo.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {repo.language && <span>{repo.language}</span>}
              <span className="inline-flex items-center gap-1">
                <Star className="size-3" />
                {repo.stars.toLocaleString()}
              </span>
              <a
                href={repo.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                View on GitHub
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </header>

        {(isAnalyzing || repo.status === 'FAILED') && (
          <Card className="p-4">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                {isAnalyzing && <Loader2 className="size-3.5 animate-spin text-primary" />}
                {repo.analysisJob?.currentStep ?? 'Queued'}
              </span>
              <span className="font-mono text-xs tabular-nums">{progress}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            {repo.analysisJob?.errorMessage && (
              <p className="mt-3 flex items-start gap-2 text-xs text-danger">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                {repo.analysisJob.errorMessage}
              </p>
            )}
          </Card>
        )}

        <nav className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {tabs.map((tab) =>
            tab.available ? (
              <Link
                key={tab.label}
                href={tab.href}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 transition-colors',
                  'hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <tab.icon className="size-4 text-primary" />
                <span className="text-sm font-medium">{tab.label}</span>
              </Link>
            ) : (
              <div
                key={tab.label}
                aria-disabled
                title="Available once analysis reaches this stage"
                className="flex cursor-not-allowed flex-col items-start gap-2 rounded-lg border border-dashed border-border p-4 opacity-50"
              >
                <tab.icon className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">{tab.label}</span>
              </div>
            ),
          )}
        </nav>

        {repo.architecture && (
          <Card>
            <CardHeader>
              <CardTitle>Architecture overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {repo.architecture.overview}
              </p>
              {(repo.architecture.techStack as string[]).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(repo.architecture.techStack as string[]).map((tech) => (
                    <Badge key={tech} variant="primary">
                      {tech}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {repo.modules.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Modules</h2>
              <Link
                href={`${base}/modules`}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                View all {repo.modules.length}
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {repo.modules.slice(0, 4).map((mod) => (
                <Card key={mod.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium">{mod.name}</h3>
                      <p className="truncate font-mono text-xs text-muted-foreground">{mod.path}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {mod.fileCount} files
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {mod.responsibility}
                  </p>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageShell>
  )
}
