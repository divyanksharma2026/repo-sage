import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import { FastifyInstance, FastifyRequest } from 'fastify'
import { env } from '../config.js'
import { prisma } from '../lib/prisma.js'

export default fp(async (app: FastifyInstance) => {
  await app.register(cookie, { secret: env.SESSION_SECRET })

  app.decorate('authenticate', async (request: FastifyRequest) => {
    const token = request.cookies['session']
    if (!token) throw new Error('No session token')

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      throw new Error('Session expired or invalid')
    }

    return session.user
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<import('@reposage/db').User>
  }
}
