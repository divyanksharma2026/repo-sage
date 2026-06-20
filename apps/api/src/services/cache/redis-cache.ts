import { Redis } from 'ioredis'

const TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

export async function getCached<T>(redis: Redis, key: string): Promise<T | null> {
  const value = await redis.get(key)
  if (!value) return null
  return JSON.parse(value) as T
}

export async function setCached<T>(redis: Redis, key: string, value: T): Promise<void> {
  await redis.setex(key, TTL_SECONDS, JSON.stringify(value))
}

export function fileExplanationKey(contentHash: string): string {
  return `file:explanation:${contentHash}`
}

export function repoGraphKey(repositoryId: string): string {
  return `repo:graph:${repositoryId}`
}

export function repoArchitectureKey(repositoryId: string): string {
  return `repo:architecture:${repositoryId}`
}
