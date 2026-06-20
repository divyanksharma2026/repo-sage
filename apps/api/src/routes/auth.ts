import { FastifyInstance } from 'fastify'
import { env } from '../config.js'
import crypto from 'crypto'

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  // GET /auth/github — redirect to GitHub OAuth
  app.get('/auth/github', async (request, reply) => {
    const state = crypto.randomBytes(16).toString('hex')
    reply.setCookie('oauth_state', state, { httpOnly: true, maxAge: 600 })

    const url = new URL(GITHUB_AUTH_URL)
    url.searchParams.set('client_id', env.GITHUB_CLIENT_ID)
    url.searchParams.set('redirect_uri', `${env.API_URL}/auth/callback`)
    url.searchParams.set('scope', 'read:user user:email repo')
    url.searchParams.set('state', state)

    return reply.redirect(url.toString())
  })

  // GET /auth/callback — exchange code for token
  app.get<{ Querystring: { code: string; state: string } }>(
    '/auth/callback',
    async (request, reply) => {
      const { code, state } = request.query
      const savedState = request.cookies['oauth_state']

      if (!savedState || savedState !== state) {
        return reply.status(400).send({ error: 'Invalid state parameter' })
      }

      // Exchange code for access token
      const tokenRes = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${env.API_URL}/auth/callback`,
        }),
      })

      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string }
      if (!tokenData.access_token) {
        return reply.status(400).send({ error: 'Failed to get access token' })
      }

      // Fetch GitHub user
      const userRes = await fetch(GITHUB_USER_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const ghUser = (await userRes.json()) as {
        id: number
        login: string
        name: string | null
        email: string | null
        avatar_url: string
      }

      // Upsert user in DB
      const user = await app.prisma.user.upsert({
        where: { githubId: String(ghUser.id) },
        create: {
          githubId: String(ghUser.id),
          login: ghUser.login,
          name: ghUser.name,
          email: ghUser.email,
          avatarUrl: ghUser.avatar_url,
          githubToken: tokenData.access_token,
        },
        update: {
          login: ghUser.login,
          name: ghUser.name,
          avatarUrl: ghUser.avatar_url,
          githubToken: tokenData.access_token,
        },
      })

      // Create session
      const sessionToken = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) // 30 days

      await app.prisma.session.create({
        data: { token: sessionToken, userId: user.id, expiresAt },
      })

      reply.setCookie('session', sessionToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/',
      })

      return reply.redirect(`${env.WEB_URL}/repos`)
    },
  )

  // POST /auth/logout
  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies['session']
    if (token) {
      await app.prisma.session.deleteMany({ where: { token } })
    }
    reply.clearCookie('session')
    return reply.send({ ok: true })
  })

  // GET /auth/me
  app.get('/auth/me', async (request, reply) => {
    const token = request.cookies['session']
    if (!token) return reply.status(401).send({ error: 'Not authenticated' })

    const session = await app.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'Session expired' })
    }

    const { githubToken: _token, ...safeUser } = session.user
    return reply.send({ user: safeUser })
  })
}
