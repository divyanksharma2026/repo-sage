'use client'

import { Blocks, DoorOpen, Layers, Shapes } from 'lucide-react'
import { useRepoRoute } from '@/hooks/use-repo'
import { RepoBackLink } from '@/components/repo-back-link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { PageShell, PageHeading } from '@/components/page-shell'

export default function ArchitecturePage() {
  const { repo, loading } = useRepoRoute()

  if (loading) {
    return (
      <PageShell>
        <div className="space-y-6">
          <RepoBackLink />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </PageShell>
    )
  }

  if (!repo?.architecture) {
    return (
      <PageShell>
        <div className="space-y-6">
          <RepoBackLink />
          <EmptyState
            icon={Blocks}
            title="No architecture data yet"
            description="This arrives about a quarter of the way through the analysis. Head back to watch progress."
          />
        </div>
      </PageShell>
    )
  }

  const arch = repo.architecture
  const techStack = arch.techStack as string[]
  const patterns = arch.patterns as string[]
  const entryPoints = arch.entryPoints as string[]

  return (
    <PageShell>
      <div className="space-y-8">
        <RepoBackLink />
        <PageHeading title="Architecture" description={repo.fullName} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {arch.overview}
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Blocks className="size-4 text-primary" />
                Tech stack
              </CardTitle>
            </CardHeader>
            <CardContent>
              {techStack.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing detected.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {techStack.map((t) => (
                    <Badge key={t} variant="primary">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shapes className="size-4 text-primary" />
                Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patterns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing detected.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {patterns.map((p) => (
                    <Badge key={p}>{p}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DoorOpen className="size-4 text-primary" />
              Entry points
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entryPoints.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing detected.</p>
            ) : (
              <ul className="space-y-1.5">
                {entryPoints.map((ep) => (
                  <li key={ep} className="font-mono text-xs text-muted-foreground">
                    {ep}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Analyzed by {arch.llmProvider} / {arch.llmModel}
        </p>
      </div>
    </PageShell>
  )
}
