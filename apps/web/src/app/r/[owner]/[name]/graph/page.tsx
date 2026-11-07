'use client'

import { useRepoRoute } from '@/hooks/use-repo'
import { RepoBackLink } from '@/components/repo-back-link'
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
import { api } from '@/lib/api-client'
import type { DependencyGraph } from '@reposage/types'

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

const nodeColor = (type: string) => {
  if (type === 'FILE') return '#3b82f6'
  if (type === 'MODULE') return '#8b5cf6'
  return '#6b7280'
}

export default function GraphPage() {
  const { repoId } = useRepoRoute()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)

  const fetchGraph = useCallback(async () => {
    if (!repoId) return // still resolving owner/name → id
    const data = await api.get<{ graph: DependencyGraph }>(`/repos/${repoId}/graph`)
    const { graph } = data

    const rfNodes: Node[] = graph.nodes.map((n) => ({
      id: n.nodeId,
      data: { label: n.label },
      position: { x: 0, y: 0 },
      style: {
        background: nodeColor(n.type),
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
      style: { stroke: '#374151', strokeWidth: 1 },
    }))

    const laid = layoutGraph(rfNodes, rfEdges)
    setNodes(laid.nodes)
    setEdges(laid.edges)
    setLoading(false)
  }, [repoId])

  useEffect(() => { void fetchGraph() }, [fetchGraph])

  if (loading || nodes.length === 0)
    return (
      <div className="min-h-screen bg-background p-8 space-y-4">
        <RepoBackLink />
        <p className="text-muted-foreground">
          {loading ? 'Building dependency graph...' : 'No graph data available.'}
        </p>
      </div>
    )

  return (
    <div style={{ width: '100vw', height: '100vh' }} className="relative">
      <div className="absolute top-4 left-4 z-10 bg-card/90 backdrop-blur border border-border rounded-md px-3 py-1.5">
        <RepoBackLink />
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode="dark"
      >
        <Background />
        <Controls />
        <MiniMap nodeColor={(n) => (n.style?.background as string) ?? '#374151'} />
      </ReactFlow>
    </div>
  )
}
