import { prisma } from '../../lib/prisma.js'
import { getEmbeddingProvider } from '../embeddings/factory.js'
import type { Citation } from '@reposage/types'

/** How many chunks go into the prompt. */
export const DEFAULT_TOP_K = 10
/** Per-file cap, so one long file cannot fill every slot. */
const MAX_PER_FILE = 3

interface SearchRow {
  file_path: string
  start_line: number
  end_line: number
  content: string
  score: number
}

export async function countIndexedChunks(repositoryId: string): Promise<number> {
  return prisma.codeChunk.count({ where: { repositoryId } })
}

/**
 * Semantic search over a repository's chunks.
 *
 * `<=>` is pgvector's cosine distance, so `1 - distance` is cosine similarity
 * in [0, 1]. There is deliberately no score floor: a floor tuned for one
 * embedding model silently returns nothing under another, and the chat prompt
 * already tells the model to say when the context does not answer the question.
 */
export async function retrieveChunks(
  repositoryId: string,
  question: string,
  topK: number = DEFAULT_TOP_K,
): Promise<Citation[]> {
  const embedder = getEmbeddingProvider()
  const queryVector = `[${(await embedder.embedQuery(question)).join(',')}]`

  // Over-fetch so the per-file cap still leaves topK results.
  const rows = await prisma.$queryRaw<SearchRow[]>`
    SELECT file_path, start_line, end_line, content,
           1 - (embedding <=> ${queryVector}::vector) AS score
    FROM code_chunks
    WHERE repository_id = ${repositoryId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${queryVector}::vector
    LIMIT ${topK * MAX_PER_FILE}
  `

  const perFile = new Map<string, number>()
  const citations: Citation[] = []

  for (const row of rows) {
    const seen = perFile.get(row.file_path) ?? 0
    if (seen >= MAX_PER_FILE) continue
    perFile.set(row.file_path, seen + 1)

    citations.push({
      ref: citations.length + 1,
      filePath: row.file_path,
      startLine: row.start_line,
      endLine: row.end_line,
      snippet: row.content,
      score: Number(row.score),
    })

    if (citations.length >= topK) break
  }

  return citations
}
