import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'

export default fp(async (app: FastifyInstance) => {
  await prisma.$connect()
  app.decorate('prisma', prisma)

  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    prisma: typeof prisma
  }
}
