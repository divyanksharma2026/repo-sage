import Fastify from 'fastify'
import { loggerConfig } from './lib/logger.js'
import { AppError } from './lib/errors.js'

// Plugins
import dbPlugin from './plugins/db.js'
import redisPlugin from './plugins/redis.js'
import corsPlugin from './plugins/cors.js'
import authPlugin from './plugins/auth.js'
import rateLimitPlugin from './plugins/rate-limit.js'

// Routes
import authRoutes from './routes/auth.js'
import repoRoutes from './routes/repos.js'
import analyzeRoutes from './routes/analyze.js'
import sseRoutes from './routes/sse.js'
import explainRoutes from './routes/explain.js'
import graphRoutes from './routes/graph.js'

export async function buildApp() {
  const app = Fastify({ logger: loggerConfig })

  // Plugins (order matters — db/redis before auth, auth before rate-limit)
  await app.register(dbPlugin)
  await app.register(redisPlugin)
  await app.register(corsPlugin)
  await app.register(authPlugin)
  await app.register(rateLimitPlugin)

  // Error handler
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message, code: error.code })
    }
    app.log.error(error)
    return reply.status(500).send({ error: 'Internal server error' })
  })

  // Routes
  await app.register(authRoutes)
  await app.register(repoRoutes)
  await app.register(analyzeRoutes)
  await app.register(sseRoutes)
  await app.register(explainRoutes)
  await app.register(graphRoutes)

  // Health check
  app.get('/health', async () => ({ ok: true }))

  return app
}
