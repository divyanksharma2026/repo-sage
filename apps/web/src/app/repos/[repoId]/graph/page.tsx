'use client'

import { useParams } from 'next/navigation'
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
  const { repoId } = useParams<{ repoId: string }>()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)

  const fetchGraph = useCallback(async () => {
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

  if (loading) return <div className="p-8 text-muted-foreground">Building dependency graph...</div>
  if (nodes.length === 0) return <div className="p-8 text-muted-foreground">No graph data available.</div>

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
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
