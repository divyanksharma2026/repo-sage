import { Redis } from 'ioredis'
import { env } from '../config.js'

export function createRedisClient(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
}
