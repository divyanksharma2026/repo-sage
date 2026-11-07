import * as crypto from 'crypto'
import type { CodeChunk } from '@reposage/types'

/**
 * Line-aware chunking. A chunk never splits a line, so every chunk carries an
 * exact 1-indexed, inclusive [startLine, endLine] range — that range is what
 * chat answers cite, so accuracy here is the whole point.
 */

const MAX_CHUNK_CHARS = 1400
const OVERLAP_LINES = 3
const MAX_FILE_BYTES = 200_000
/** Minified bundles and generated files embed terribly and crowd out real code. */
const MAX_MEAN_LINE_CHARS = 300

const INDEXABLE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'go', 'rs', 'java', 'kt', 'rb',
  'php', 'cs', 'swift', 'scala', 'c', 'h', 'cpp', 'hpp', 'cc', 'sql', 'sh',
  'md', 'mdx', 'yml', 'yaml', 'toml', 'json', 'prisma', 'graphql', 'vue', 'svelte',
])

const SKIP_PATH_PATTERNS = [
  /\.min\.(js|css)$/,
  /\.d\.ts$/,
  /(?:^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock|go\.sum)$/,
  /(?:^|\/)__snapshots__\//,
  /(?:^|\/)migrations?\/.*\.(sql)$/,
]

export function shouldIndexFile(filePath: string, content: string): boolean {
  if (SKIP_PATH_PATTERNS.some((p) => p.test(filePath))) return false

  const ext = filePath.includes('.') ? (filePath.split('.').pop() ?? '').toLowerCase() : ''
  if (!INDEXABLE_EXTENSIONS.has(ext)) return false

  if (content.length === 0 || content.length > MAX_FILE_BYTES) return false
  // A NUL byte means we decoded something that was never text.
  if (content.includes('\u0000')) return false

  const lineCount = content.split('\n').length
  if (content.length / lineCount > MAX_MEAN_LINE_CHARS) return false

  return true
}

function hashChunk(filePath: string, startLine: number, endLine: number, body: string): string {
  return crypto
    .createHash('sha256')
    .update(`${filePath}#${startLine}-${endLine}\n${body}`)
    .digest('hex')
}

/**
 * Greedily packs whole lines up to MAX_CHUNK_CHARS, then rewinds OVERLAP_LINES
 * so a declaration split across a boundary still appears intact in one chunk.
 */
export function chunkFile(filePath: string, content: string): CodeChunk[] {
  const lines = content.split('\n')
  const chunks: CodeChunk[] = []

  let cursor = 0 // 0-indexed line we start the next chunk at

  while (cursor < lines.length) {
    let end = cursor // exclusive
    let size = 0

    while (end < lines.length) {
      const lineLength = (lines[end] ?? '').length + 1 // + newline
      // Always take at least one line, otherwise a very long line loops forever.
      if (size > 0 && size + lineLength > MAX_CHUNK_CHARS) break
      size += lineLength
      end++
    }

    const body = lines.slice(cursor, end).join('\n')
    const startLine = cursor + 1
    const endLine = end

    // Only whitespace is worth dropping. A short chunk still holds real code,
    // and dropping it would silently lose lines next to an over-long line.
    if (body.trim().length > 0) {
      chunks.push({
        filePath,
        startLine,
        endLine,
        content: body,
        contentHash: hashChunk(filePath, startLine, endLine, body),
      })
    }

    if (end >= lines.length) break
    // Rewind for overlap, but never back onto a line we already started at.
    cursor = Math.max(cursor + 1, end - OVERLAP_LINES)
  }

  // A short file produces no chunk above but is still worth indexing whole.
  if (chunks.length === 0 && content.trim().length > 0) {
    const endLine = lines.length
    chunks.push({
      filePath,
      startLine: 1,
      endLine,
      content,
      contentHash: hashChunk(filePath, 1, endLine, content),
    })
  }

  return chunks
}

/** Chunks every indexable file, in a stable order. */
export function chunkFiles(fileContents: Map<string, string>): CodeChunk[] {
  const chunks: CodeChunk[] = []

  for (const filePath of Array.from(fileContents.keys()).sort()) {
    const content = fileContents.get(filePath)
    if (content == null || !shouldIndexFile(filePath, content)) continue
    chunks.push(...chunkFile(filePath, content))
  }

  return chunks
}

/**
 * What the embedding model actually sees. The path is part of the text on
 * purpose: "where does auth happen" should match a file under src/auth/ even
 * when the body never says the word.
 */
export function chunkEmbeddingText(chunk: CodeChunk): string {
  return `File: ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})\n\n${chunk.content}`
}
