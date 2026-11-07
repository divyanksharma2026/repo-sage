'use client'

import { Boxes, FileCode2 } from 'lucide-react'
import { useRepoRoute } from '@/hooks/use-repo'
import { RepoBackLink } from '@/components/repo-back-link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { PageShell, PageHeading } from '@/components/page-shell'

export default function ModulesPage() {
  const { repo, loading } = useRepoRoute()

  if (loading) {
    return (
      <PageShell width="wide">
        <div className="space-y-6">
          <RepoBackLink />
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        </div>
      </PageShell>
    )
  }

  if (!repo || repo.modules.length === 0) {
    return (
      <PageShell width="wide">
        <div className="space-y-6">
          <RepoBackLink />
          <EmptyState
            icon={Boxes}
            title={repo ? 'No modules detected yet' : 'Could not load this repository'}
            description={
              repo
                ? 'Module summaries land partway through the analysis. Head back to watch progress.'
                : undefined
            }
          />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell width="wide">
      <div className="space-y-8">
        <RepoBackLink />
        <PageHeading
          title="Modules"
          description={`${repo.modules.length} detected in ${repo.fullName}`}
        />

        <div className="grid gap-4 md:grid-cols-2">
          {repo.modules.map((mod) => {
            const imports = mod.imports as string[]
            return (
              <Card key={mod.id} className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{mod.name}</h2>
                    <p className="truncate font-mono text-xs text-muted-foreground">{mod.path}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    <FileCode2 />
                    {mod.fileCount}
                  </Badge>
                </div>

                {mod.responsibility && (
                  <p className="text-sm font-medium leading-relaxed">{mod.responsibility}</p>
                )}
                <p className="text-sm leading-relaxed text-muted-foreground">{mod.summary}</p>

                {imports.length > 0 && (
                  <div className="mt-auto space-y-1.5 pt-1">
                    <p className="text-xs font-medium text-muted-foreground">Dependencies</p>
                    <div className="flex flex-wrap gap-1">
                      {imports.map((dep) => (
                        <span
                          key={dep}
                          className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-secondary-foreground"
                        >
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </PageShell>
  )
}
