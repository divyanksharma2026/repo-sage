import { Redis } from 'ioredis'
import type { SSEProgressEvent } from '@reposage/types'

export function sseChannel(repositoryId: string): string {
  return `sse:repo:${repositoryId}`
}

export async function publishProgress(
  redis: Redis,
  event: SSEProgressEvent,
): Promise<void> {
  await redis.publish(sseChannel(event.repositoryId), JSON.stringify(event))
}
