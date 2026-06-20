import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import { FastifyInstance } from 'fastify'
import { env } from '../config.js'

export default fp(async (app: FastifyInstance) => {
  await app.register(cors, {
    origin: env.WEB_URL,
    credentials: true,
  })
})
