'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useFileExplanation } from '@/hooks/use-file-explanation'
import { api } from '@/lib/api-client'

function buildTree(paths: string[]): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  for (const p of paths) {
    const parts = p.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!
      if (!node[part]) node[part] = {}
      node = node[part] as Record<string, unknown>
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
  node: Record<string, unknown>
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
        return (
          <li key={key}>
            {isDir ? (
              <>
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
                  className="flex items-center gap-1 w-full text-left px-2 py-0.5 rounded hover:bg-accent text-muted-foreground"
                  style={{ paddingLeft: `${depth * 12 + 8}px` }}
                >
                  <span className="text-xs">{isOpen ? '▾' : '▸'}</span>
                  <span>{key}/</span>
                </button>
                {isOpen && (
                  <FileTree
                    node={val as Record<string, unknown>}
                    selected={selected}
                    onSelect={onSelect}
                    depth={depth + 1}
                  />
                )}
              </>
            ) : (
              <button
                onClick={() => onSelect(val as string)}
                className={`flex items-center gap-1 w-full text-left px-2 py-0.5 rounded text-foreground hover:bg-accent ${
                  selected === val ? 'bg-accent font-medium' : ''
                }`}
                style={{ paddingLeft: `${depth * 12 + 20}px` }}
              >
                {key}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default function FilesPage() {
  const { repoId } = useParams<{ repoId: string }>()
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [search, setSearch] = useState('')
  const { text, streaming, explain } = useFileExplanation(repoId)

  useEffect(() => {
    api.get<{ files: string[] }>(`/repos/${repoId}/files`)
      .then((d) => { setFiles(d.files); setLoading(false) })
      .catch((e: Error) => { setError(e.message); setLoading(false) })
  }, [repoId])

  const handleSelect = (path: string) => {
    setSelected(path)
    void explain(path)
  }

  const filtered = search
    ? files.filter((f) => f.toLowerCase().includes(search.toLowerCase()))
    : files

  const tree = buildTree(filtered)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 border-r border-border flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter files..."
            className="w-full bg-card border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-xs text-muted-foreground px-2 pt-2">Loading files...</p>
          ) : error ? (
            <p className="text-xs text-red-400 px-2 pt-2">Error: {error}</p>
          ) : files.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 pt-2">No files indexed yet. Run analysis first.</p>
          ) : (
            <FileTree node={tree} selected={selected} onSelect={handleSelect} />
          )}
        </div>
        <div className="p-2 border-t border-border text-xs text-muted-foreground">
          {files.length} files
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 overflow-y-auto p-8">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground space-y-2">
            <span className="text-4xl">📂</span>
            <p className="text-sm">Select a file from the tree to see its AI explanation</p>
          </div>
        ) : (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono bg-card border border-border px-3 py-1 rounded-md text-foreground">
                {selected}
              </code>
              {streaming && (
                <span className="text-xs text-muted-foreground animate-pulse">Explaining...</span>
              )}
            </div>

            {(text || streaming) && (
              <div className="bg-card border border-border rounded-lg p-5">
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {text}
                  {streaming && <span className="animate-pulse">▊</span>}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
