import { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/require-auth.js'
import { getAnalysisQueue } from '../jobs/queue.js'
import { NotFoundError } from '../lib/errors.js'

export default async function analyzeRoutes(app: FastifyInstance): Promise<void> {
  // POST /repos/:id/analyze — enqueue analysis job
  app.post<{ Params: { id: string } }>(
    '/repos/:id/analyze',
    { preHandler: requireAuth },
    async (request, reply) => {
      const repo = await app.prisma.repository.findFirst({
        where: { id: request.params.id, userId: request.user.id },
        include: { analysisJob: true },
      })
      if (!repo) throw new NotFoundError('Repository')

      if (repo.status === 'FETCHING' || repo.status === 'ANALYZING') {
        return reply.status(409).send({ error: 'Analysis already in progress' })
      }

      const queue = getAnalysisQueue()

      const jobId = `repo-${repo.id}`

      // Remove any stale job with the same ID before re-enqueuing
      const existingJob = await queue.getJob(jobId)
      if (existingJob) await existingJob.remove()

      const job = await queue.add(
        'analyze',
        {
          repositoryId: repo.id,
          userId: request.user.id,
          owner: repo.owner,
          name: repo.name,
          defaultBranch: repo.defaultBranch,
          githubToken: request.user.githubToken,
        },
        { jobId },
      )

      await app.prisma.repository.update({
        where: { id: repo.id },
        data: { status: 'PENDING' },
      })

      await app.prisma.analysisJob.upsert({
        where: { repositoryId: repo.id },
        create: { repositoryId: repo.id, bullJobId: job.id },
        update: { bullJobId: job.id, progress: 0, errorMessage: null, startedAt: null, completedAt: null },
      })

      return reply.status(202).send({ jobId: job.id, repositoryId: repo.id })
    },
  )
}
