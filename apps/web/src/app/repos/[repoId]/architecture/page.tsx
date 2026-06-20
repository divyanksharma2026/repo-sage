'use client'

import { useParams } from 'next/navigation'
import { useRepo } from '@/hooks/use-repo'

export default function ArchitecturePage() {
  const { repoId } = useParams<{ repoId: string }>()
  const { repo, loading } = useRepo(repoId)

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>
  if (!repo?.architecture) return <div className="p-8 text-muted-foreground">No architecture data yet.</div>

  const arch = repo.architecture

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">Architecture Overview</h1>

        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{arch.overview}</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-lg p-6 space-y-3">
            <h2 className="font-semibold text-sm">Tech Stack</h2>
            <div className="flex flex-wrap gap-2">
              {(arch.techStack as string[]).map((t) => (
                <span key={t} className="bg-secondary text-xs px-2 py-1 rounded">{t}</span>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 space-y-3">
            <h2 className="font-semibold text-sm">Patterns</h2>
            <div className="flex flex-wrap gap-2">
              {(arch.patterns as string[]).map((p) => (
                <span key={p} className="bg-secondary text-xs px-2 py-1 rounded">{p}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 space-y-3">
          <h2 className="font-semibold text-sm">Entry Points</h2>
          <ul className="space-y-1">
            {(arch.entryPoints as string[]).map((ep) => (
              <li key={ep} className="text-xs font-mono text-muted-foreground">{ep}</li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          Analyzed by {arch.llmProvider} / {arch.llmModel}
        </p>
      </div>
    </div>
  )
}
