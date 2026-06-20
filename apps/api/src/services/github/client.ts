import { Octokit } from '@octokit/rest'
import { env } from '../../config.js'

export function createGithubClient(userToken?: string): Octokit {
  return new Octokit({ auth: userToken ?? env.GITHUB_PAT })
}
