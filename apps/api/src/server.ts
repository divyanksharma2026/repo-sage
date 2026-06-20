import { buildApp } from './app.js'
import { env } from './config.js'

const app = await buildApp()

try {
  await app.listen({ port: 3001, host: '0.0.0.0' })
  app.log.info(`API running at ${env.API_URL}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
