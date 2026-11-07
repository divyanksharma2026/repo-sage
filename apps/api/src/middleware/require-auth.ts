import { FastifyRequest, FastifyReply } from 'fastify'
import { UnauthorizedError } from '../lib/errors.js'

/** Rejects anonymous callers. Use only for routes that are inherently personal. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const user = await request.server.authenticate(request)
    request.user = user
    request.currentUser = user
  } catch {
    const err = new UnauthorizedError()
    reply.status(err.statusCode).send({ error: err.message, code: err.code })
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Only set after `requireAuth`. Anywhere else, read `currentUser`. */
    user: import('@reposage/db').User
    /** Set by both `requireAuth` and `optionalAuth`; null when anonymous. */
    currentUser: import('@reposage/db').User | null
  }
}
