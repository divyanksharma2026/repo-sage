import { FastifyInstance } from 'fastify'
import { optionalAuth } from '../middleware/optional-auth.js'
import { assertRepoAccess } from '../lib/access.js'
import { createRedisClient } from '../lib/redis.js'
import { sseChannel } from '../workers/sse-publisher.js'

export default async function sseRoutes(app: FastifyInstance): Promise<void> {
  // GET /repos/:id/status — SSE stream for job progress
  app.get<{ Params: { id: string } }>(
    '/repos/:id/status',
    { preHandler: optionalAuth },
    async (request, reply) => {
      const found = await app.prisma.repository.findUnique({
        where: { id: request.params.id },
        include: { analysisJob: true },
      })
      const repo = await assertRepoAccess(found, request.currentUser)

      const subscriber = createRedisClient()
      const channel = sseChannel(repo.id)

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })

      let closed = false
      const keepAlive = setInterval(() => {
        reply.raw.write(': ping\n\n')
      }, 20_000)

      // Registered before the first await: a client that disconnects during
      // subscribe() used to leave this Redis connection open forever.
      const cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(keepAlive)
        void subscriber.unsubscribe(channel).catch(() => {})
        void subscriber.quit().catch(() => {})
      }
      request.raw.on('close', cleanup)

      // Subscribe first, then send the snapshot, so nothing published in
      // between is lost. Events that arrive before the snapshot is written are
      // buffered and flushed after it, keeping progress monotonic.
      let snapshotSent = false
      const pending: string[] = []

      subscriber.on('message', (_channel, message) => {
        if (closed) return
        if (!snapshotSent) {
          pending.push(message)
          return
        }
        reply.raw.write(`data: ${message}\n\n`)
      })

      await subscriber.subscribe(channel)
      if (closed) return

      reply.raw.write(
        `data: ${JSON.stringify({
          repositoryId: repo.id,
          progress: repo.analysisJob?.progress ?? 0,
          currentStep: repo.analysisJob?.currentStep ?? 'Queued',
          status: repo.status,
        })}\n\n`,
      )
      snapshotSent = true

      for (const message of pending) reply.raw.write(`data: ${message}\n\n`)
      pending.length = 0
    },
  )
}
