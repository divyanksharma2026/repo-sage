import { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/require-auth.js'
import { getLLMProvider } from '../services/llm/factory.js'
import { fileExplanationPrompt, SYSTEM_PROMPT } from '../services/llm/prompts.js'
import { getCached, setCached, fileExplanationKey } from '../services/cache/redis-cache.js'
import { createGithubClient } from '../services/github/client.js'
import { fetchFileContent } from '../services/github/fetcher.js'
import { NotFoundError } from '../lib/errors.js'
import crypto from 'crypto'
import type { FileExplanation } from '@reposage/types'

export default async function explainRoutes(app: FastifyInstance): Promise<void> {
  // GET /repos/:id/files — list all files in the repo (from graph nodes)
  app.get<{ Params: { id: string } }>(
    '/repos/:id/files',
    { preHandler: requireAuth },
    async (request, reply) => {
      const repo = await app.prisma.repository.findFirst({
        where: { id: request.params.id, userId: request.user.id },
      })
      if (!repo) throw new NotFoundError('Repository')

      const nodes = await app.prisma.graphNode.findMany({
        where: { repositoryId: repo.id, type: 'FILE', path: { not: null } },
        orderBy: { path: 'asc' },
        select: { path: true },
      })

      const files = nodes.map((n) => n.path as string)
      app.log.info({ repoId: repo.id, count: files.length }, 'files list fetched')
      return reply.send({ files })
    },
  )

  // GET /repos/:id/files/explain?path=src/index.ts — streaming SSE file explanation
  app.get<{ Params: { id: string }; Querystring: { path: string } }>(
    '/repos/:id/files/explain',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { path: filePath } = request.query
      if (!filePath) return reply.status(400).send({ error: 'path query param is required' })

      const repo = await app.prisma.repository.findFirst({
        where: { id: request.params.id, userId: request.user.id },
      })
      if (!repo) throw new NotFoundError('Repository')

      // Fetch file content
      const octokit = createGithubClient(request.user.githubToken)
      let content: string
      try {
        content = await fetchFileContent(octokit, repo.owner, repo.name, filePath)
      } catch {
        return reply.status(404).send({ error: 'File not found in repository' })
      }

      const contentHash = crypto.createHash('sha256').update(content).digest('hex')

      // Check cache first (DB)
      const existing = await app.prisma.fileExplanation.findUnique({
        where: { repositoryId_contentHash: { repositoryId: repo.id, contentHash } },
      })

      if (existing) {
        // Serve cached — still as SSE so UI is consistent
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })
        reply.raw.write(`data: ${JSON.stringify({ text: existing.explanation, done: true })}\n\n`)
        reply.raw.end()
        return
      }

      // Check Redis cache
      const redisKey = fileExplanationKey(contentHash)
      const redisHit = await getCached<FileExplanation>(app.redis, redisKey)

      if (redisHit) {
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })
        reply.raw.write(`data: ${JSON.stringify({ text: redisHit.explanation, done: true })}\n\n`)
        reply.raw.end()
        return
      }

      // Stream from LLM
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })

      const llm = getLLMProvider()
      let fullText = ''
      let parseError = false

      const llmResponse = await llm.stream(
        fileExplanationPrompt(filePath, content.slice(0, 3000)),
        SYSTEM_PROMPT,
        (chunk) => {
          fullText += chunk
          reply.raw.write(`data: ${JSON.stringify({ text: chunk, done: false })}\n\n`)
        },
      )

      reply.raw.write(`data: ${JSON.stringify({ text: '', done: true })}\n\n`)
      reply.raw.end()

      // Persist to DB + Redis cache (fire and forget)
      let parsed: {
        purpose: string
        explanation: string
        keyFunctions: { name: string; description: string }[]
        dependencies: string[]
      }

      try {
        const cleaned = llmResponse.text.replace(/```json\n?|\n?```/g, '').trim()
        parsed = JSON.parse(cleaned)
      } catch {
        parseError = true
        parsed = {
          purpose: '',
          explanation: llmResponse.text,
          keyFunctions: [],
          dependencies: [],
        }
      }

      if (!parseError) {
        void app.prisma.fileExplanation
          .upsert({
            where: { repositoryId_contentHash: { repositoryId: repo.id, contentHash } },
            create: {
              repositoryId: repo.id,
              filePath,
              contentHash,
              explanation: parsed.explanation,
              purpose: parsed.purpose,
              keyFunctions: parsed.keyFunctions,
              dependencies: parsed.dependencies,
              llmProvider: llm.providerName,
            },
            update: { explanation: parsed.explanation },
          })
          .catch((err) => app.log.error({ err }, 'Failed to persist file explanation'))

        void setCached(app.redis, redisKey, parsed)
      }
    },
  )
}
