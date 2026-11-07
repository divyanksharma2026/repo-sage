import { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/require-auth.js'
import { optionalAuth } from '../middleware/optional-auth.js'
import { assertRepoAccess } from '../lib/access.js'
import { createGithubClient } from '../services/github/client.js'
import { fetchRepoMeta } from '../services/github/fetcher.js'
import { NotFoundError, UnauthorizedError } from '../lib/errors.js'
import { RATE_LIMITS } from '../lib/rate-limits.js'
import { env } from '../config.js'
import { z } from 'zod'

const createRepoSchema = z.object({
  githubUrl: z.string().url().includes('github.com'),
})

const REPO_DETAIL_INCLUDE = {
  architecture: true,
  modules: { orderBy: { fileCount: 'desc' } },
  analysisJob: true,
} as const

/** `https://github.com/owner/repo(.git)(/tree/main)` → `{ owner, name }`. */
function parseRepoUrl(githubUrl: string): { owner: string; name: string } | null {
  const segments = new URL(githubUrl).pathname.split('/').filter(Boolean)
  const owner = segments[0]
  const name = segments[1]?.replace(/\.git$/, '')
  if (!owner || !name) return null
  return { owner, name }
}

export default async function repoRoutes(app: FastifyInstance): Promise<void> {
  // GET /repos — the signed-in user's saved list.
  app.get('/repos', { preHandler: requireAuth }, async (request, reply) => {
    const saved = await app.prisma.userRepository.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        repository: {
          select: {
            id: true,
            owner: true,
            name: true,
            fullName: true,
            description: true,
            language: true,
            stars: true,
            isPrivate: true,
            status: true,
            analyzedAt: true,
            createdAt: true,
          },
        },
      },
    })

    return reply.send({ repos: saved.map((s) => s.repository) })
  })

  // POST /repos — add a repository.
  //
  // Anonymous callers may add public repositories. A repository already known
  // to us is reused rather than re-analyzed, which is the point of keying it
  // globally: the second person to ask for a popular repo pays nothing.
  app.post<{ Body: { githubUrl: string } }>(
    '/repos',
    {
      preHandler: optionalAuth,
      config: { rateLimit: RATE_LIMITS.addRepo },
    },
    async (request, reply) => {
      const parsed = createRepoSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid GitHub URL' })
      }

      const target = parseRepoUrl(parsed.data.githubUrl)
      if (!target) {
        return reply.status(400).send({ error: 'Could not parse owner/repo from URL' })
      }

      const user = request.currentUser
      const fullName = `${target.owner}/${target.name}`
      const existing = await app.prisma.repository.findUnique({ where: { fullName } })

      if (existing) {
        if (existing.isPrivate) {
          // Re-check with GitHub rather than trusting our own row: only someone
          // who can still read the repo upstream may join it here.
          if (!user) throw new UnauthorizedError()
          try {
            await fetchRepoMeta(createGithubClient(user.githubToken), target.owner, target.name)
          } catch {
            throw new NotFoundError('Repository')
          }
        }

        if (user) {
          await app.prisma.userRepository.upsert({
            where: { userId_repositoryId: { userId: user.id, repositoryId: existing.id } },
            create: { userId: user.id, repositoryId: existing.id },
            update: {},
          })
        }

        return reply.status(200).send({ repo: existing, reused: true })
      }

      const token = user?.githubToken ?? env.GITHUB_PAT
      let meta
      try {
        meta = await fetchRepoMeta(createGithubClient(token), target.owner, target.name)
      } catch {
        // GitHub answers 404 for both "missing" and "no access", and so do we.
        throw new NotFoundError('Repository')
      }

      if (meta.isPrivate && !user) throw new UnauthorizedError()

      const repo = await app.prisma.repository.create({
        data: {
          githubUrl: parsed.data.githubUrl,
          owner: target.owner,
          name: target.name,
          fullName,
          defaultBranch: meta.defaultBranch,
          description: meta.description,
          language: meta.language,
          stars: meta.stars,
          isPrivate: meta.isPrivate,
          analysisJob: { create: {} },
          ...(user ? { savedBy: { create: { userId: user.id } } } : {}),
        },
      })

      return reply.status(201).send({ repo, reused: false })
    },
  )

  // GET /repos/:id
  app.get<{ Params: { id: string } }>(
    '/repos/:id',
    { preHandler: optionalAuth },
    async (request, reply) => {
      const repo = await app.prisma.repository.findUnique({
        where: { id: request.params.id },
        include: REPO_DETAIL_INCLUDE,
      })

      await assertRepoAccess(repo, request.currentUser)
      return reply.send({ repo })
    },
  )

  // GET /repos/by/:owner/:name — what /r/<owner>/<name> resolves against, so a
  // shared link works without anyone knowing our internal id.
  app.get<{ Params: { owner: string; name: string } }>(
    '/repos/by/:owner/:name',
    { preHandler: optionalAuth },
    async (request, reply) => {
      const repo = await app.prisma.repository.findUnique({
        where: { fullName: `${request.params.owner}/${request.params.name}` },
        include: REPO_DETAIL_INCLUDE,
      })

      await assertRepoAccess(repo, request.currentUser)
      return reply.send({ repo })
    },
  )

  // DELETE /repos/:id — removes it from *your* list. The analysis itself is
  // shared, so one person removing it must not delete it for everyone.
  app.delete<{ Params: { id: string } }>(
    '/repos/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { count } = await app.prisma.userRepository.deleteMany({
        where: { userId: request.user.id, repositoryId: request.params.id },
      })
      if (count === 0) throw new NotFoundError('Repository')

      return reply.send({ ok: true })
    },
  )
}
