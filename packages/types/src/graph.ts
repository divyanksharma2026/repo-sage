export type NodeType = 'FILE' | 'MODULE' | 'EXTERNAL_PACKAGE'
export type EdgeType = 'IMPORTS' | 'DEPENDS_ON' | 'EXTENDS' | 'CALLS'

export interface GraphNode {
  id: string
  nodeId: string
  label: string
  type: NodeType
  path: string | null
  metadata: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  sourceId: string
  targetId: string
  type: EdgeType
  weight: number
}

export interface DependencyGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
