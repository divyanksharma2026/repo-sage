import { FastifyInstance } from 'fastify'
import { optionalAuth } from '../middleware/optional-auth.js'
import { assertRepoAccess } from '../lib/access.js'
import { RATE_LIMITS } from '../lib/rate-limits.js'
import { getLLMProvider } from '../services/llm/factory.js'
import { chatPrompt, CHAT_SYSTEM_PROMPT } from '../services/llm/prompts.js'
import { retrieveChunks, countIndexedChunks } from '../services/search/retrieve.js'
import type { ChatStreamEvent, ChatTurn } from '@reposage/types'

const MAX_QUESTION_CHARS = 2000
/** Turns of history kept, newest last. Enough for follow-ups, bounded for cost. */
const MAX_HISTORY_TURNS = 6

export default async function chatRoutes(app: FastifyInstance): Promise<void> {
  // GET /repos/:id/chat/status — is the repo searchable yet?
  app.get<{ Params: { id: string } }>(
    '/repos/:id/chat/status',
    { preHandler: optionalAuth },
    async (request, reply) => {
      const found = await app.prisma.repository.findUnique({
        where: { id: request.params.id },
        select: { id: true, isPrivate: true },
      })
      const repo = await assertRepoAccess(found, request.currentUser)

      const chunks = await countIndexedChunks(repo.id)
      return reply.send({ indexed: chunks > 0, chunks })
    },
  )

  // POST /repos/:id/chat — retrieval-augmented answer, streamed as SSE.
  //
  // POST rather than GET because the question and history go in the body, so
  // the browser uses fetch + ReadableStream here, not EventSource.
  app.post<{ Params: { id: string }; Body: { question?: unknown; history?: unknown } }>(
    '/repos/:id/chat',
    {
      preHandler: optionalAuth,
      config: { rateLimit: RATE_LIMITS.chat },
    },
    async (request, reply) => {
      const { question, history } = request.body ?? {}

      if (typeof question !== 'string' || question.trim().length === 0) {
        return reply.status(400).send({ error: 'question is required' })
      }
      if (question.length > MAX_QUESTION_CHARS) {
        return reply.status(400).send({ error: `question must be under ${MAX_QUESTION_CHARS} characters` })
      }

      const found = await app.prisma.repository.findUnique({
        where: { id: request.params.id },
        select: { id: true, isPrivate: true },
      })
      const repo = await assertRepoAccess(found, request.currentUser)

      const turns: ChatTurn[] = Array.isArray(history)
        ? history
            .filter(
              (t): t is ChatTurn =>
                typeof t === 'object' &&
                t !== null &&
                (((t as ChatTurn).role === 'user') || ((t as ChatTurn).role === 'assistant')) &&
                typeof (t as ChatTurn).content === 'string',
            )
            .slice(-MAX_HISTORY_TURNS)
        : []

      // Retrieval happens before any bytes are written, so a failure here can
      // still be reported as a normal JSON error response.
      let citations
      try {
        citations = await retrieveChunks(repo.id, question)
      } catch (err) {
        app.log.error({ err, repoId: repo.id }, 'chat retrieval failed')
        return reply.status(503).send({ error: 'Code search is unavailable. Check the embedding provider key.' })
      }

      if (citations.length === 0) {
        return reply.status(409).send({
          error: 'This repository has not been indexed for search yet. Run the analysis again.',
        })
      }

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })

      const send = (event: ChatStreamEvent) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
      }

      // Sources go first so the UI can render citation targets while the
      // answer is still streaming in.
      send({ type: 'sources', citations })

      try {
        const llm = getLLMProvider()
        await llm.stream(chatPrompt(question, citations, turns), CHAT_SYSTEM_PROMPT, (text) => {
          send({ type: 'token', text })
        })
        send({ type: 'done' })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        app.log.error({ err, repoId: repo.id }, 'chat generation failed')
        send({ type: 'error', message })
      } finally {
        reply.raw.end()
      }
    },
  )
}
