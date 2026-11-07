const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Retryable: rate limits (429) and capacity errors (503 "high demand", which
 * Gemini's free tier returns constantly on its newest models). Both clear on
 * their own; a bad key or a retired model id never will.
 */
function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /429|503|quota|rate.?limit|retry|overload|high demand|unavailable/i.test(msg)
}

/**
 * Retry transient provider failures with exponential backoff. Anything else is
 * rethrown immediately — a bad API key should fail fast.
 */
export async function withRateLimitRetry<T>(fn: () => Promise<T>, retries = 4): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (!isTransient(err) || attempt === retries - 1) throw err
      // 5s, 10s, 20s — long enough to outlast a per-minute quota reset, which
      // a 2s backoff just burns attempts against.
      await sleep(5000 * 2 ** attempt)
    }
  }
  throw new Error('Max retries exceeded')
}
