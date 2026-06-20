import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { Redis } from 'ioredis'
import { createRedisClient } from '../lib/redis.js'

export default fp(async (app: FastifyInstance) => {
  const redis = createRedisClient()

  redis.on('error', (err) => app.log.error({ err }, 'Redis connection error'))

  app.decorate('redis', redis)

  app.addHook('onClose', async () => {
    await redis.quit()
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}
