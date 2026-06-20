import { Octokit } from '@octokit/rest'

export interface RepoFile {
  path: string
  size: number
  sha: string
  url: string
}

export interface RepoMeta {
  defaultBranch: string
  description: string | null
  language: string | null
  stars: number
  isPrivate: boolean
}

const SKIP_PATTERNS = [
  /(?:^|\/)node_modules\//,
  /(?:^|\/)vendor\//,
  /^\.git\//,
  /(?:^|\/)dist\//,
  /(?:^|\/)build\//,
  /^\.next\//,
  /^coverage\//,
  /^\.turbo\//,
  /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|mp4|mp3|pdf)$/i,
  /^(yarn\.lock|package-lock\.json|pnpm-lock\.yaml)$/,
]

const PRIORITY_FILES = [
  /^(main|index|app|server|entry)\.(ts|js|py|go|rs|java)$/,
  /^(package\.json|go\.mod|requirements\.txt|Cargo\.toml|pom\.xml|pyproject\.toml)$/,
  /^(README|readme)\.(md|txt)$/,
  /^(docker-compose|Dockerfile)/,
]

export async function fetchRepoMeta(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<RepoMeta> {
  const { data } = await octokit.repos.get({ owner, repo })
  return {
    defaultBranch: data.default_branch,
    description: data.description,
    language: data.language ?? null,
    stars: data.stargazers_count,
    isPrivate: data.private,
  }
}

export async function fetchFileTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
): Promise<RepoFile[]> {
  const { data } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: 'true',
  })

  return (data.tree as Array<{ path?: string; size?: number; sha?: string; url?: string; type?: string }>)
    .filter((item) => item.type === 'blob' && item.path != null)
    .filter((item) => !SKIP_PATTERNS.some((p) => p.test(item.path!)))
    .map((item) => ({
      path: item.path!,
      size: item.size ?? 0,
      sha: item.sha ?? '',
      url: item.url ?? '',
    }))
}

export function selectKeyFiles(files: RepoFile[], maxFiles = 20): RepoFile[] {
  const prioritized = files.filter((f) => PRIORITY_FILES.some((p) => p.test(f.path.split('/').pop() ?? '')))
  const rest = files
    .filter((f) => !prioritized.includes(f))
    .filter((f) => f.size < 50_000)
    .sort((a, b) => b.size - a.size)

  return [...prioritized, ...rest].slice(0, maxFiles)
}

export async function fetchFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
): Promise<string> {
  const { data } = await octokit.repos.getContent({ owner, repo, path })

  if (Array.isArray(data) || data.type !== 'file') {
    throw new Error(`${path} is not a file`)
  }

  return Buffer.from(data.content, 'base64').toString('utf-8')
}

export function buildFileTreeString(files: RepoFile[]): string {
  return files.map((f) => f.path).join('\n')
}

const SKIP_MODULE_PREFIXES = [
  'node_modules',
  'vendor',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.turbo',
  '__pycache__',
  '.venv',
  'venv',
]

export function detectModules(files: RepoFile[]): Map<string, RepoFile[]> {
  const modules = new Map<string, RepoFile[]>()

  for (const file of files) {
    const parts = file.path.split('/')
    if (parts.length < 2) continue

    // Skip generated/dependency directories at any path level
    if (parts.some((p) => SKIP_MODULE_PREFIXES.includes(p))) continue

    // Use top-level directory as module (src/auth/foo.ts → "src/auth")
    const moduleKey = parts.length >= 3 ? `${parts[0]}/${parts[1]}` : parts[0]
    if (!modules.has(moduleKey)) modules.set(moduleKey, [])
    modules.get(moduleKey)!.push(file)
  }

  // Drop directories with only 1 file — not really a module
  for (const [key, moduleFiles] of modules) {
    if (moduleFiles.length < 2) modules.delete(key)
  }

  return modules
}
