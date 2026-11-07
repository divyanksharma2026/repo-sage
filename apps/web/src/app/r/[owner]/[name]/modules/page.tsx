'use client'

import { useRepoRoute } from '@/hooks/use-repo'
import { RepoBackLink } from '@/components/repo-back-link'

export default function ModulesPage() {
  const { repo, loading } = useRepoRoute()

  if (loading)
    return (
    <div className="min-h-screen bg-background p-8 space-y-4">
      <RepoBackLink />
      <p className="text-muted-foreground">Loading...</p>
    </div>
    )
  if (!repo)
    return (
    <div className="min-h-screen bg-background p-8 space-y-4">
      <RepoBackLink />
      <p className="text-muted-foreground">Could not load this repository.</p>
    </div>
    )

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <RepoBackLink />
        <h1 className="text-2xl font-bold">Modules</h1>
        <p className="text-muted-foreground text-sm">{repo.modules.length} modules detected</p>

        <div className="grid gap-4 md:grid-cols-2">
          {repo.modules.map((mod) => (
            <div key={mod.id} className="bg-card border border-border rounded-lg p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold">{mod.name}</h2>
                  <p className="text-xs text-muted-foreground font-mono">{mod.path}</p>
                </div>
                <span className="text-xs text-muted-foreground">{mod.fileCount} files</span>
              </div>

              <p className="text-sm text-muted-foreground">{mod.responsibility}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{mod.summary}</p>

              {(mod.imports as string[]).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">Dependencies</p>
                  <div className="flex flex-wrap gap-1">
                    {(mod.imports as string[]).map((dep) => (
                      <span key={dep} className="bg-secondary text-xs px-2 py-0.5 rounded font-mono">
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
