import * as crypto from 'crypto'
import type { RepoFile } from '../github/fetcher.js'
import type { DependencyGraph } from '@reposage/types'

const JS_TS_IMPORT = /(?:import|require)\s*(?:\(?\s*['"]([^'"]+)['"]\s*\)?|.*?from\s+['"]([^'"]+)['"])/g
const PYTHON_IMPORT = /^(?:import|from)\s+([\w.]+)/gm
const GO_IMPORT = /import\s+"([^"]+)"/g

function extractImports(content: string, filePath: string): string[] {
  const imports: string[] = []
  const ext = filePath.split('.').pop() ?? ''

  let match: RegExpExecArray | null
  const pattern =
    ext === 'py' ? PYTHON_IMPORT : ext === 'go' ? GO_IMPORT : JS_TS_IMPORT

  pattern.lastIndex = 0
  while ((match = pattern.exec(content)) !== null) {
    const dep = match[1] ?? match[2]
    if (dep) imports.push(dep)
  }

  return imports
}

function isRelativeImport(dep: string): boolean {
  return dep.startsWith('.') || dep.startsWith('/')
}

function resolveRelativePath(fromFile: string, dep: string): string {
  const dir = fromFile.split('/').slice(0, -1).join('/')
  const resolved = `${dir}/${dep}`.replace(/\/\.\//g, '/').replace(/[^/]+\/\.\.\//g, '')
  return resolved.replace(/^\//, '')
}

interface BuildGraphInput {
  files: RepoFile[]
  fileContents: Map<string, string>
}

export function buildDependencyGraph({ files, fileContents }: BuildGraphInput): DependencyGraph {
  const nodes: DependencyGraph['nodes'] = []
  const edges: DependencyGraph['edges'] = []
  const edgeSet = new Set<string>()
  const filePaths = new Set(files.map((f) => f.path))

  for (const file of files) {
    nodes.push({
      id: crypto.createHash('md5').update(file.path).digest('hex'),
      nodeId: file.path,
      label: file.path.split('/').pop() ?? file.path,
      type: 'FILE',
      path: file.path,
      metadata: { size: file.size },
    })
  }

  for (const file of files) {
    const content = fileContents.get(file.path)
    if (!content) continue

    const imports = extractImports(content, file.path)

    for (const dep of imports) {
      if (isRelativeImport(dep)) {
        // Internal file dependency
        const candidates = [dep, `${dep}.ts`, `${dep}.js`, `${dep}/index.ts`, `${dep}/index.js`].map(
          (c) => resolveRelativePath(file.path, c),
        )

        const target = candidates.find((c) => filePaths.has(c))
        if (target) {
          const edgeKey = `${file.path}→${target}`
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey)
            edges.push({
              id: crypto.createHash('md5').update(edgeKey).digest('hex'),
              sourceId: file.path,
              targetId: target,
              type: 'IMPORTS',
              weight: 1,
            })
          }
        }
      } else {
        // External package — add as EXTERNAL_PACKAGE node if not already present
        const pkgName = dep.startsWith('@') ? dep.split('/').slice(0, 2).join('/') : dep.split('/')[0]!
        if (!nodes.find((n) => n.nodeId === pkgName)) {
          nodes.push({
            id: crypto.createHash('md5').update(pkgName).digest('hex'),
            nodeId: pkgName,
            label: pkgName,
            type: 'EXTERNAL_PACKAGE',
            path: null,
            metadata: {},
          })
        }

        const edgeKey = `${file.path}→${pkgName}`
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey)
          edges.push({
            id: crypto.createHash('md5').update(edgeKey).digest('hex'),
            sourceId: file.path,
            targetId: pkgName,
            type: 'DEPENDS_ON',
            weight: 1,
          })
        }
      }
    }
  }

  return { nodes, edges }
}
