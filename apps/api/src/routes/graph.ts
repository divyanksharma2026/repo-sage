import { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/require-auth.js'
import { NotFoundError } from '../lib/errors.js'
import { getCached, setCached, repoGraphKey } from '../services/cache/redis-cache.js'
import type { DependencyGraph } from '@reposage/types'

export default async function graphRoutes(app: FastifyInstance): Promise<void> {
  // GET /repos/:id/graph
  app.get<{ Params: { id: string } }>(
    '/repos/:id/graph',
    { preHandler: requireAuth },
    async (request, reply) => {
      const repo = await app.prisma.repository.findFirst({
        where: { id: request.params.id, userId: request.user.id },
      })
      if (!repo) throw new NotFoundError('Repository')
      if (repo.status !== 'COMPLETED') {
        return reply.status(409).send({ error: 'Analysis not complete' })
      }

      const cacheKey = repoGraphKey(repo.id)
      const cached = await getCached<DependencyGraph>(app.redis, cacheKey)
      if (cached) return reply.send({ graph: cached })

      const [nodes, edges] = await Promise.all([
        app.prisma.graphNode.findMany({ where: { repositoryId: repo.id } }),
        app.prisma.graphEdge.findMany({ where: { repositoryId: repo.id } }),
      ])

      const graph: DependencyGraph = {
        nodes: nodes.map((n) => ({
          id: n.id,
          nodeId: n.nodeId,
          label: n.label,
          type: n.type,
          path: n.path,
          metadata: n.metadata as Record<string, unknown>,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          sourceId: e.sourceId,
          targetId: e.targetId,
          type: e.type,
          weight: e.weight,
        })),
      }

      await setCached(app.redis, cacheKey, graph)
      return reply.send({ graph })
    },
  )
}
