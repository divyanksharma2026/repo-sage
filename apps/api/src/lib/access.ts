import { env } from '../config.js'
import { prisma } from './prisma.js'
import { NotFoundError } from './errors.js'
import type { User } from '@reposage/db'

/** The minimum a caller must load for an access decision. */
export interface AccessibleRepo {
  id: string
  isPrivate: boolean
}

/**
 * Public repositories are readable by anyone, logged in or not — that is the
 * whole point of a shareable link.
 *
 * A private repository is readable only by users who hold a UserRepository
 * row for it, and that row is only ever written after GitHub itself confirmed
 * the user can read the repo (see POST /repos). GitHub stays the source of
 * truth for authorization; we only cache its answer.
 */
export async function canAccessRepo(repo: AccessibleRepo, user: User | null): Promise<boolean> {
  if (!repo.isPrivate) return true
  if (!user) return false

  const saved = await prisma.userRepository.findUnique({
    where: { userId_repositoryId: { userId: user.id, repositoryId: repo.id } },
    select: { id: true },
  })

  return saved !== null
}

/**
 * Throws NotFound — never Unauthorized — when access is denied, so an outsider
 * cannot probe which private repositories exist.
 */
export async function assertRepoAccess<T extends AccessibleRepo>(
  repo: T | null,
  user: User | null,
): Promise<T> {
  if (!repo) throw new NotFoundError('Repository')
  if (!(await canAccessRepo(repo, user))) throw new NotFoundError('Repository')
  return repo
}

/**
 * Which GitHub credential to call the API with.
 *
 * A signed-in user's own token is preferred even for public repos, because the
 * rate limit then counts against them (5000/hr) instead of the shared server
 * token. Returns undefined only when nothing is configured, which means
 * unauthenticated GitHub access at 60 requests/hour.
 */
export function githubTokenFor(repo: { isPrivate: boolean }, user: User | null): string | undefined {
  if (repo.isPrivate) return user?.githubToken
  return user?.githubToken ?? env.GITHUB_PAT ?? undefined
}

/**
 * An anonymous analysis burns ~100+ GitHub calls, so the 60/hour
 * unauthenticated budget is not enough to finish even one run.
 */
export function canRunAnonymousAnalysis(): boolean {
  return Boolean(env.GITHUB_PAT)
}
