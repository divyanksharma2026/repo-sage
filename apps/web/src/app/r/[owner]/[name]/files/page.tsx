'use client'

import { useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  FolderOpen,
  Loader2,
  MousePointerClick,
  Search,
} from 'lucide-react'
import { useRepoRoute } from '@/hooks/use-repo'
import { useFileExplanation } from '@/hooks/use-file-explanation'
import { RepoBackLink } from '@/components/repo-back-link'
import { EmptyState } from '@/components/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

type TreeNode = Record<string, unknown>

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = {}
  for (const p of paths) {
    const parts = p.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!
      if (!node[part]) node[part] = {}
      node = node[part] as TreeNode
    }
    node[parts[parts.length - 1]!] = p
  }
  return root
}

function FileTree({
  node,
  selected,
  onSelect,
  depth = 0,
}: {
  node: TreeNode
  selected: string
  onSelect: (path: string) => void
  depth?: number
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const entries = Object.entries(node).sort(([aKey, aVal], [bKey, bVal]) => {
    const aIsDir = typeof aVal === 'object'
    const bIsDir = typeof bVal === 'object'
    if (aIsDir && !bIsDir) return -1
    if (!aIsDir && bIsDir) return 1
    return aKey.localeCompare(bKey)
  })

  return (
    <ul className="text-sm">
      {entries.map(([key, val]) => {
        const isDir = typeof val === 'object'
        const isOpen = !collapsed[key]

        if (isDir) {
          return (
            <li key={key}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {isOpen ? (
                  <ChevronDown className="size-3 shrink-0" />
                ) : (
                  <ChevronRight className="size-3 shrink-0" />
                )}
                {isOpen ? (
                  <FolderOpen className="size-3.5 shrink-0 text-primary/70" />
                ) : (
                  <Folder className="size-3.5 shrink-0 text-primary/70" />
                )}
                <span className="truncate text-xs">{key}</span>
              </button>
              {isOpen && (
                <FileTree
                  node={val as TreeNode}
                  selected={selected}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              )}
            </li>
          )
        }

        const path = val as string
        return (
          <li key={key}>
            <button
              onClick={() => onSelect(path)}
              style={{ paddingLeft: `${depth * 12 + 22}px` }}
              className={cn(
                'flex w-full items-center gap-1.5 rounded px-2 py-1 text-left transition-colors hover:bg-accent',
                selected === path
                  ? 'bg-accent font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <FileCode2 className="size-3.5 shrink-0 opacity-60" />
              <span className="truncate text-xs">{key}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default function FilesPage() {
  const { repoId } = useRepoRoute()
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [search, setSearch] = useState('')
  const { text, streaming, explain } = useFileExplanation(repoId ?? '')

  useEffect(() => {
    if (!repoId) return // still resolving owner/name → id
    api
      .get<{ files: string[] }>(`/repos/${repoId}/files`)
      .then((d) => {
        setFiles(d.files)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [repoId])

  const handleSelect = (path: string) => {
    setSelected(path)
    void explain(path)
  }

  const filtered = search
    ? files.filter((f) => f.toLowerCase().includes(search.toLowerCase()))
    : files

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border">
        <div className="space-y-3 border-b border-border p-3">
          <RepoBackLink />
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter files…"
              aria-label="Filter files"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-5" style={{ width: `${55 + ((i * 13) % 40)}%` }} />
              ))}
            </div>
          ) : error ? (
            <p className="px-2 pt-2 text-xs text-danger">{error}</p>
          ) : files.length === 0 ? (
            <p className="px-2 pt-2 text-xs text-muted-foreground">
              No files indexed yet. Run the analysis first.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-2 pt-2 text-xs text-muted-foreground">No file matches “{search}”.</p>
          ) : (
            <FileTree node={buildTree(filtered)} selected={selected} onSelect={handleSelect} />
          )}
        </div>

        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          {filtered.length === files.length
            ? `${files.length} files`
            : `${filtered.length} of ${files.length}`}
        </div>
      </aside>

      <main className="scrollbar-thin flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex h-full items-center justify-center p-8">
            <EmptyState
              icon={MousePointerClick}
              title="Pick a file"
              description="Choose a file from the tree and its explanation is generated here, then cached by content hash."
            />
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4 p-8 animate-fade-in">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-xs">
                {selected}
              </code>
              {streaming && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin text-primary" />
                  Explaining…
                </span>
              )}
            </div>

            {(text || streaming) && (
              <div className="rounded-lg border border-border bg-card p-5">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {text}
                  {streaming && <span className="animate-pulse">▊</span>}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
