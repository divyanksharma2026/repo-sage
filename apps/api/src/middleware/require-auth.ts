import { FastifyRequest, FastifyReply } from 'fastify'
import { UnauthorizedError } from '../lib/errors.js'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const user = await request.server.authenticate(request)
    request.user = user
  } catch {
    const err = new UnauthorizedError()
    reply.status(err.statusCode).send({ error: err.message, code: err.code })
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user: import('@reposage/db').User
  }
}
