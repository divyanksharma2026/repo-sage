import { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/require-auth.js'
import { createRedisClient } from '../lib/redis.js'
import { sseChannel } from '../workers/sse-publisher.js'
import { NotFoundError } from '../lib/errors.js'

export default async function sseRoutes(app: FastifyInstance): Promise<void> {
  // GET /repos/:id/status — SSE stream for job progress
  app.get<{ Params: { id: string } }>(
    '/repos/:id/status',
    { preHandler: requireAuth },
    async (request, reply) => {
      const repo = await app.prisma.repository.findFirst({
        where: { id: request.params.id, userId: request.user.id },
        include: { analysisJob: true },
      })
      if (!repo) throw new NotFoundError('Repository')

      const subscriber = createRedisClient()
      const channel = sseChannel(repo.id)

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })

      // Send current state immediately
      reply.raw.write(
        `data: ${JSON.stringify({
          repositoryId: repo.id,
          progress: repo.analysisJob?.progress ?? 0,
          currentStep: repo.analysisJob?.currentStep ?? 'Queued',
          status: repo.status,
        })}\n\n`,
      )

      await subscriber.subscribe(channel)

      subscriber.on('message', (_channel, message) => {
        reply.raw.write(`data: ${message}\n\n`)
      })

      const keepAlive = setInterval(() => {
        reply.raw.write(': ping\n\n')
      }, 20_000)

      request.raw.on('close', async () => {
        clearInterval(keepAlive)
        await subscriber.unsubscribe(channel)
        await subscriber.quit()
      })
    },
  )
}
