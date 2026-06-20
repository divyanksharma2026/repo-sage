import { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/require-auth.js'
import { createGithubClient } from '../services/github/client.js'
import { fetchRepoMeta } from '../services/github/fetcher.js'
import { NotFoundError, ConflictError } from '../lib/errors.js'
import { z } from 'zod'

const createRepoSchema = z.object({
  githubUrl: z.string().url().includes('github.com'),
})

export default async function repoRoutes(app: FastifyInstance): Promise<void> {
  // GET /repos — list user's repos
  app.get('/repos', { preHandler: requireAuth }, async (request, reply) => {
    const repos = await app.prisma.repository.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        description: true,
        language: true,
        stars: true,
        status: true,
        analyzedAt: true,
        createdAt: true,
      },
    })
    return reply.send({ repos })
  })

  // POST /repos — add a new repo
  app.post<{ Body: { githubUrl: string } }>(
    '/repos',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = createRepoSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid GitHub URL' })
      }

      const url = new URL(parsed.data.githubUrl)
      const [, owner, repoName] = url.pathname.split('/')
      if (!owner || !repoName) {
        return reply.status(400).send({ error: 'Could not parse owner/repo from URL' })
      }

      const existing = await app.prisma.repository.findUnique({
        where: { userId_fullName: { userId: request.user.id, fullName: `${owner}/${repoName}` } },
      })
      if (existing) throw new ConflictError('Repository already added')

      const octokit = createGithubClient(request.user.githubToken)
      const meta = await fetchRepoMeta(octokit, owner, repoName)

      const repo = await app.prisma.repository.create({
        data: {
          userId: request.user.id,
          githubUrl: parsed.data.githubUrl,
          owner,
          name: repoName,
          fullName: `${owner}/${repoName}`,
          defaultBranch: meta.defaultBranch,
          description: meta.description,
          language: meta.language,
          stars: meta.stars,
          isPrivate: meta.isPrivate,
          analysisJob: { create: {} },
        },
      })

      return reply.status(201).send({ repo })
    },
  )

  // GET /repos/:id — get repo details with analysis
  app.get<{ Params: { id: string } }>(
    '/repos/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const repo = await app.prisma.repository.findFirst({
        where: { id: request.params.id, userId: request.user.id },
        include: {
          architecture: true,
          modules: { orderBy: { fileCount: 'desc' } },
          analysisJob: true,
        },
      })

      if (!repo) throw new NotFoundError('Repository')
      return reply.send({ repo })
    },
  )

  // DELETE /repos/:id
  app.delete<{ Params: { id: string } }>(
    '/repos/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const repo = await app.prisma.repository.findFirst({
        where: { id: request.params.id, userId: request.user.id },
      })
      if (!repo) throw new NotFoundError('Repository')

      await app.prisma.repository.delete({ where: { id: repo.id } })
      return reply.send({ ok: true })
    },
  )
}
