import * as crypto from 'crypto'
import { Prisma } from '@reposage/db'
import { prisma } from '../../lib/prisma.js'
import { chunkFiles, chunkEmbeddingText } from '../chunking/chunker.js'
import { getEmbeddingProvider } from '../embeddings/factory.js'
import type { CodeChunk } from '@reposage/types'

/** Rows per INSERT. Keeps us far below Postgres' 65535 bound parameter limit. */
const INSERT_BATCH = 200
/** Texts per embedding call, so progress moves and a retry re-does little. */
const EMBED_BATCH = 100

export interface IndexResult {
  chunks: number
  files: number
  model: string
}

/** pgvector parses its input from a `[a,b,c]` string literal. */
function toVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`
}

interface PendingRow {
  chunk: CodeChunk
  vector: string
}

async function insertChunks(
  repositoryId: string,
  rows: PendingRow[],
  embeddingModel: string,
): Promise<void> {
  // Embedding happened before this call, so the delete and the inserts commit
  // together: a failure mid-way leaves the previous index intact rather than
  // wiping it and leaving the repo unsearchable.
  await prisma.$transaction(
    async (tx) => {
      await tx.codeChunk.deleteMany({ where: { repositoryId } })

      for (let i = 0; i < rows.length; i += INSERT_BATCH) {
        const batch = rows.slice(i, i + INSERT_BATCH)

        const values = batch.map(
          ({ chunk, vector }) => Prisma.sql`(
            ${crypto.randomUUID()},
            ${repositoryId},
            ${chunk.filePath},
            ${chunk.startLine},
            ${chunk.endLine},
            ${chunk.content},
            ${chunk.contentHash},
            ${vector}::vector,
            ${embeddingModel}
          )`,
        )

        await tx.$executeRaw`
          INSERT INTO code_chunks (
            id, repository_id, file_path, start_line, end_line,
            content, content_hash, embedding, embedding_model
          )
          VALUES ${Prisma.join(values)}
          ON CONFLICT (repository_id, content_hash) DO NOTHING
        `
      }
    },
    { maxWait: 10_000, timeout: 120_000 },
  )
}

/**
 * Chunks every indexable file, embeds the chunks, and replaces the repository's
 * search index with the result.
 *
 * `onProgress` receives a 0..1 fraction of the embedding work, which is the
 * only slow part.
 */
export async function indexRepository(
  repositoryId: string,
  fileContents: Map<string, string>,
  onProgress?: (fraction: number) => Promise<void>,
): Promise<IndexResult> {
  const embedder = getEmbeddingProvider()
  const chunks = chunkFiles(fileContents)

  if (chunks.length === 0) {
    await prisma.codeChunk.deleteMany({ where: { repositoryId } })
    return { chunks: 0, files: 0, model: embedder.modelName }
  }

  const rows: PendingRow[] = []

  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH)
    const vectors = await embedder.embedDocuments(batch.map(chunkEmbeddingText))

    if (vectors.length !== batch.length) {
      throw new Error(`Embedding provider returned ${vectors.length} vectors for ${batch.length} chunks`)
    }

    batch.forEach((chunk, j) => {
      const values = vectors[j]
      if (!values) {
        throw new Error(`Embedding provider returned no vector for ${chunk.filePath}`)
      }
      if (values.length !== embedder.dimensions) {
        throw new Error(
          `Expected ${embedder.dimensions}-dim embedding, got ${values.length} for ${chunk.filePath}`,
        )
      }
      rows.push({ chunk, vector: toVectorLiteral(values) })
    })

    await onProgress?.(Math.min(1, (i + batch.length) / chunks.length))
  }

  await insertChunks(repositoryId, rows, embedder.modelName)

  return {
    chunks: rows.length,
    files: new Set(rows.map((r) => r.chunk.filePath)).size,
    model: embedder.modelName,
  }
}
