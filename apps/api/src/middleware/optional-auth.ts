import { FastifyRequest } from 'fastify'

/**
 * Resolves the session if there is one, but never rejects. Routes that serve
 * public repositories use this and then gate on the repository itself via
 * `assertRepoAccess` — being logged out is not an error, it just limits which
 * repositories are visible.
 */
export async function optionalAuth(request: FastifyRequest): Promise<void> {
  try {
    request.currentUser = await request.server.authenticate(request)
  } catch {
    request.currentUser = null
  }
}
