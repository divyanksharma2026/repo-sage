'use client'

import { useParams } from 'next/navigation'
import { useRepo } from '@/hooks/use-repo'
import { useSSE } from '@/hooks/use-sse'
import Link from 'next/link'
import type { SSEProgressEvent } from '@reposage/types'

export default function RepoPage() {
  const { repoId } = useParams<{ repoId: string }>()
  const { repo, loading, error, refetch } = useRepo(repoId)

  const isAnalyzing = repo?.status === 'FETCHING' || repo?.status === 'ANALYZING' || repo?.status === 'PENDING'

  useSSE<SSEProgressEvent>({
    url: `/api/repos/${repoId}/status`,
    enabled: isAnalyzing,
    onMessage: (event) => {
      if (event.status === 'COMPLETED' || event.status === 'FAILED') {
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

        {isAnalyzing && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {repo.analysisJob?.currentStep ?? 'Queued'}
              </span>
              <span>{repo.analysisJob?.progress ?? 0}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${repo.analysisJob?.progress ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {repo.status === 'COMPLETED' && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Architecture', href: `/repos/${repoId}/architecture` },
              { label: 'Modules', href: `/repos/${repoId}/modules` },
              { label: 'Files', href: `/repos/${repoId}/files` },
              { label: 'Graph', href: `/repos/${repoId}/graph` },
            ].map((tab) => (
              <Link
                key={tab.label}
                href={tab.href}
                className="bg-card border border-border rounded-lg p-4 text-center font-medium hover:border-ring hover:bg-accent transition-colors"
              >
                {tab.label}
              </Link>
            ))}
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
