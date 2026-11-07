'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { Network } from 'lucide-react'
import { useRepoRoute } from '@/hooks/use-repo'
import { RepoBackLink } from '@/components/repo-back-link'
import { EmptyState } from '@/components/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { PageShell } from '@/components/page-shell'
import { api } from '@/lib/api-client'
import type { DependencyGraph } from '@reposage/types'

const NODE_COLORS: Record<string, string> = {
  FILE: 'hsl(258 90% 66%)',
  MODULE: 'hsl(190 85% 55%)',
  EXTERNAL_PACKAGE: 'hsl(240 5% 40%)',
}

const LEGEND = [
  { label: 'File', type: 'FILE' },
  { label: 'Module', type: 'MODULE' },
  { label: 'External package', type: 'EXTERNAL_PACKAGE' },
]

function layoutGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 80 })
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach((n) => g.setNode(n.id, { width: 150, height: 40 }))
  edges.forEach((e) => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return {
    nodes: nodes.map((n) => {
      const pos = g.node(n.id)
      return { ...n, position: { x: pos.x - 75, y: pos.y - 20 } }
    }),
    edges,
  }
}

export default function GraphPage() {
  const { repoId } = useRepoRoute()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGraph = useCallback(async () => {
    if (!repoId) return // still resolving owner/name → id
    try {
      const { graph } = await api.get<{ graph: DependencyGraph }>(`/repos/${repoId}/graph`)

      const rfNodes: Node[] = graph.nodes.map((n) => ({
        id: n.nodeId,
        data: { label: n.label },
        position: { x: 0, y: 0 },
        style: {
          background: NODE_COLORS[n.type] ?? NODE_COLORS.EXTERNAL_PACKAGE,
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '11px',
          padding: '4px 8px',
        },
      }))

      const rfEdges: Edge[] = graph.edges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        animated: e.type === 'IMPORTS',
        style: { stroke: 'hsl(240 6% 25%)', strokeWidth: 1 },
      }))

      const laid = layoutGraph(rfNodes, rfEdges)
      setNodes(laid.nodes)
      setEdges(laid.edges)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the graph')
    } finally {
      setLoading(false)
    }
  }, [repoId, setNodes, setEdges])

  useEffect(() => {
    void fetchGraph()
  }, [fetchGraph])

  if (loading || error || nodes.length === 0) {
    return (
      <PageShell width="wide">
        <div className="space-y-6">
          <RepoBackLink />
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-[420px] w-full" />
            </div>
          ) : (
            <EmptyState
              icon={Network}
              title={error ? 'Could not load the graph' : 'No graph data yet'}
              description={
                error ??
                'The dependency graph is built late in the analysis. Head back to watch progress.'
              }
            />
          )}
        </div>
      </PageShell>
    )
  }

  return (
    <div className="relative h-screen w-screen">
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-3 rounded-lg border border-border bg-card/90 p-3 backdrop-blur">
        <RepoBackLink />
        <div className="space-y-1.5 border-t border-border pt-2.5">
          {LEGEND.map((l) => (
            <div key={l.type} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="size-2.5 rounded-sm"
                style={{ background: NODE_COLORS[l.type] }}
                aria-hidden
              />
              {l.label}
            </div>
          ))}
        </div>
        <p className="border-t border-border pt-2.5 font-mono text-[11px] text-muted-foreground">
          {nodes.length} nodes · {edges.length} edges
        </p>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode="dark"
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={16} size={1} color="hsl(240 6% 16%)" />
        <Controls />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.style?.background as string) ?? NODE_COLORS.EXTERNAL_PACKAGE}
          maskColor="hsl(240 10% 5% / 0.7)"
        />
      </ReactFlow>
    </div>
  )
}
