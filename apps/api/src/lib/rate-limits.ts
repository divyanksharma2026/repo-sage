/**
 * Per-IP budgets for the routes that cost real money (LLM + embedding calls).
 *
 * Keyed by IP, not by session: anonymous access is the point of public repos,
 * and a session cookie is trivial to rotate, so keying on it would hand anyone
 * an unlimited budget. Everyone behind one IP shares these, which is the
 * trade-off that keeps the spend bounded.
 *
 * `@fastify/rate-limit` already defaults its keyGenerator to `request.ip`, so
 * these only need to override the window.
 */
export const RATE_LIMITS = {
  /** A full analysis: dozens of LLM calls plus embeddings for every chunk. */
  analyze: { max: 3, timeWindow: '1 hour' },
  /** One retrieval + one streamed completion per question. */
  chat: { max: 20, timeWindow: '1 hour' },
  /** One streamed completion per uncached file. */
  explain: { max: 20, timeWindow: '1 hour' },
  /** Cheap, but it writes rows and hits the GitHub API. */
  addRepo: { max: 10, timeWindow: '1 hour' },
} as const
