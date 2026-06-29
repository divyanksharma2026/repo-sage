import * as crypto from 'crypto'
import { prisma } from '../../lib/prisma.js'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
import { createGithubClient } from '../github/client.js'
import {
  fetchFileTree,
  fetchFileContent,
  selectKeyFiles,
  buildFileTreeString,
  detectModules,
  type RepoFile,
} from '../github/fetcher.js'
import { getLLMProvider } from '../llm/factory.js'
import {
  architecturePrompt,
  modulePrompt,
  SYSTEM_PROMPT,
} from '../llm/prompts.js'
import { buildDependencyGraph } from './graph.js'
import type { RepoAnalysisJobData } from '@reposage/types'

export type ProgressCallback = (progress: number, step: string) => Promise<void>

export async function runAnalysis(job: RepoAnalysisJobData, onProgress: ProgressCallback): Promise<void> {
  const { repositoryId, owner, name, defaultBranch, githubToken } = job

  const octokit = createGithubClient(githubToken)
  const llm = getLLMProvider()

  // ── 1. Fetch file tree ──────────────────────────────────────────────
  await onProgress(5, 'Fetching repository file tree')
  const allFiles = await fetchFileTree(octokit, owner, name, defaultBranch)

  // ── 2. Select key files and fetch their contents ────────────────────
  await onProgress(15, 'Selecting key files')
  const keyFiles = selectKeyFiles(allFiles)
  const fileContents = new Map<string, string>()

  const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

  await Promise.all(
    keyFiles.map(async (file) => {
      try {
        const content = await withTimeout(fetchFileContent(octokit, owner, name, file.path), 8000)
        fileContents.set(file.path, content)
      } catch {
        // Skip slow or unreadable files
      }
    }),
  )
  await onProgress(20, 'Key files loaded')

  // ── 3. Architecture overview ────────────────────────────────────────
  await onProgress(25, 'Analyzing architecture')
  const fileTreeStr = buildFileTreeString(allFiles).slice(0, 2000)
  const keyFilesStr = Array.from(fileContents.entries())
    .slice(0, 5)
    .map(([path, content]) => `--- ${path} ---\n${content.slice(0, 500)}`)
    .join('\n\n')

  const archResponse = await llm.complete(
    architecturePrompt(fileTreeStr, keyFilesStr),
    SYSTEM_PROMPT,
  )

  let archData: {
    overview: string
    techStack: string[]
    patterns: string[]
    entryPoints: string[]
  }

  try {
    const jsonMatch = archResponse.text.match(/\{[\s\S]*\}/)
    const cleaned = jsonMatch ? jsonMatch[0] : archResponse.text.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    archData = {
      overview: parsed.overview ?? archResponse.text,
      techStack: parsed.techStack ?? [],
      patterns: parsed.patterns ?? [],
      entryPoints: parsed.entryPoints ?? [],
    }
  } catch {
    archData = { overview: archResponse.text, techStack: [], patterns: [], entryPoints: [] }
  }

  await prisma.architecture.upsert({
    where: { repositoryId },
    create: {
      repositoryId,
      overview: archData.overview,
      techStack: archData.techStack,
      patterns: archData.patterns,
      entryPoints: archData.entryPoints,
      llmProvider: llm.providerName,
      llmModel: llm.modelName,
      promptTokens: archResponse.usage.promptTokens,
      completionTokens: archResponse.usage.completionTokens,
    },
    update: {
      overview: archData.overview,
      techStack: archData.techStack,
      patterns: archData.patterns,
      entryPoints: archData.entryPoints,
    },
  })

  await onProgress(35, 'Architecture overview ready')

  // ── 4. Module summaries ─────────────────────────────────────────────
  await onProgress(40, 'Analyzing modules')
  // Clear stale module data so renamed/removed modules don't persist
  await prisma.module.deleteMany({ where: { repositoryId } })
  const moduleMap = detectModules(allFiles)
  const moduleEntries = Array.from(moduleMap.entries()).slice(0, 5)

  for (const [index, [modulePath, moduleFiles]] of moduleEntries.entries()) {
    await sleep(1000) // small delay to be polite to the API
    const moduleFileContents = await Promise.all(
        moduleFiles.slice(0, 3).map(async (f) => {
          try {
            const content = fileContents.get(f.path) ?? (await fetchFileContent(octokit, owner, name, f.path))
            return `--- ${f.path} ---\n${content.slice(0, 400)}`
          } catch {
            return `--- ${f.path} --- (unreadable)`
          }
        }),
      )

      const modResponse = await llm.complete(
        modulePrompt(modulePath, moduleFileContents.join('\n\n')),
        SYSTEM_PROMPT,
      )

      let modData: {
        name: string
        summary: string
        responsibility: string
        exports: string[]
        imports: string[]
      }

      try {
        const jsonMatch = modResponse.text.match(/\{[\s\S]*\}/)
        const cleaned = jsonMatch ? jsonMatch[0] : modResponse.text.replace(/```json\n?|\n?```/g, '').trim()
        const parsed = JSON.parse(cleaned)
        modData = {
          name: parsed.name ?? modulePath.split('/').pop() ?? modulePath,
          summary: parsed.summary ?? modResponse.text,
          responsibility: parsed.responsibility ?? '',
          exports: parsed.exports ?? [],
          imports: parsed.imports ?? [],
        }
      } catch {
        modData = {
          name: modulePath.split('/').pop() ?? modulePath,
          summary: modResponse.text,
          responsibility: '',
          exports: [],
          imports: [],
        }
      }

      await prisma.module.upsert({
        where: { repositoryId_path: { repositoryId, path: modulePath } },
        create: {
          repositoryId,
          name: modData.name,
          path: modulePath,
          summary: modData.summary,
          responsibility: modData.responsibility,
          fileCount: moduleFiles.length,
          exports: modData.exports,
          imports: modData.imports,
          llmProvider: llm.providerName,
        },
        update: {
          summary: modData.summary,
          responsibility: modData.responsibility,
          exports: modData.exports,
          imports: modData.imports,
        },
      })

      const moduleProgress = Math.min(65, 45 + index * 5)
      await onProgress(moduleProgress, `Analyzed module ${modData.name}`)
  }

  await onProgress(65, 'Module summaries ready')

  // ── 5. Dependency graph ─────────────────────────────────────────────
  await onProgress(70, 'Building dependency graph')

  // Fetch content for files we don't have yet (for graph building)
  // Exclude node_modules and binary files — they bloat the graph with useless nodes
  const graphFiles: RepoFile[] = allFiles
    .filter((f) => !f.path.includes('node_modules') && !f.path.includes('vendor/'))
    .slice(0, 80)
  await Promise.all(
    graphFiles
      .filter((f) => !fileContents.has(f.path) && f.size < 20_000)
      .map(async (file) => {
        try {
          const content = await withTimeout(fetchFileContent(octokit, owner, name, file.path), 8000)
          fileContents.set(file.path, content)
        } catch {
          // skip slow or unreadable files
        }
      }),
  )
  await onProgress(75, 'Dependency files loaded')

  const graph = buildDependencyGraph({ files: graphFiles, fileContents })
  await onProgress(80, 'Dependency graph built')

  await prisma.$transaction([
    prisma.graphNode.deleteMany({ where: { repositoryId } }),
    prisma.graphEdge.deleteMany({ where: { repositoryId } }),
    prisma.graphNode.createMany({
      data: graph.nodes.map((n) => ({
        repositoryId,
        nodeId: n.nodeId,
        label: n.label,
        type: n.type,
        path: n.path,
        metadata: n.metadata,
      })),
      skipDuplicates: true,
    }),
    prisma.graphEdge.createMany({
      data: graph.edges.map((e) => ({
        repositoryId,
        sourceId: e.sourceId,
        targetId: e.targetId,
        type: e.type,
        weight: e.weight,
      })),
      skipDuplicates: true,
    }),
  ])

  await onProgress(85, 'Dependency graph ready')

  // ── 6. Mark complete ────────────────────────────────────────────────
  await prisma.repository.update({
    where: { id: repositoryId },
    data: {
      status: 'COMPLETED',
      analyzedAt: new Date(),
      contentHash: crypto.createHash('sha256').update(fileTreeStr).digest('hex'),
    },
  })

  await onProgress(100, 'Analysis complete')
}
