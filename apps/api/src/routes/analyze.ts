import { FastifyInstance } from 'fastify'
import { optionalAuth } from '../middleware/optional-auth.js'
import { assertRepoAccess, githubTokenFor, canRunAnonymousAnalysis } from '../lib/access.js'
import { getAnalysisQueue } from '../jobs/queue.js'
import { RATE_LIMITS } from '../lib/rate-limits.js'

export default async function analyzeRoutes(app: FastifyInstance): Promise<void> {
  // POST /repos/:id/analyze — enqueue analysis job
  app.post<{ Params: { id: string } }>(
    '/repos/:id/analyze',
    {
      preHandler: optionalAuth,
      config: { rateLimit: RATE_LIMITS.analyze },
    },
    async (request, reply) => {
      const found = await app.prisma.repository.findUnique({ where: { id: request.params.id } })
      const repo = await assertRepoAccess(found, request.currentUser)

      if (repo.status === 'FETCHING' || repo.status === 'ANALYZING') {
        return reply.status(409).send({ error: 'Analysis already in progress' })
      }

      const githubToken = githubTokenFor(repo, request.currentUser)
      if (!githubToken && !canRunAnonymousAnalysis()) {
        return reply.status(503).send({
          error:
            'Anonymous analysis needs a server GitHub token. Set GITHUB_PAT in .env, or sign in.',
        })
      }

      const queue = getAnalysisQueue()
      const jobId = `repo-${repo.id}`

      // Remove any stale job with the same ID before re-enqueuing
      const existingJob = await queue.getJob(jobId)
      if (existingJob) await existingJob.remove()

      // Write the rows BEFORE enqueuing. The worker updates analysis_jobs as
      // its first act, and against a local Redis it can pick the job up within
      // milliseconds — enqueuing first raced it to a missing row, and the
      // PENDING write below could also clobber the worker's FETCHING.
      await app.prisma.repository.update({
        where: { id: repo.id },
        data: { status: 'PENDING' },
      })

      await app.prisma.analysisJob.upsert({
        where: { repositoryId: repo.id },
        create: { repositoryId: repo.id, bullJobId: jobId },
        update: {
          bullJobId: jobId,
          progress: 0,
          currentStep: null,
          errorMessage: null,
          startedAt: null,
          completedAt: null,
        },
      })

      const job = await queue.add(
        'analyze',
        {
          repositoryId: repo.id,
          userId: request.currentUser?.id ?? null,
          owner: repo.owner,
          name: repo.name,
          defaultBranch: repo.defaultBranch,
          ...(githubToken ? { githubToken } : {}),
        },
        { jobId },
      )

      return reply.status(202).send({ jobId: job.id, repositoryId: repo.id })
    },
  )
}
