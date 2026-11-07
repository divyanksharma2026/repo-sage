import { env } from '../../../config.js'
import { withRateLimitRetry } from '../../../lib/retry.js'
import { EMBEDDING_DIMENSIONS, type EmbeddingProvider } from '../provider.js'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
/** Gemini caps batchEmbedContents at 100 requests per call. */
const BATCH_SIZE = 100

type TaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

interface EmbeddingValues {
  values: number[]
}

/**
 * Called over REST rather than through `@google/generative-ai`, because that
 * SDK's EmbedContentRequest has no `outputDimensionality` field — and without
 * it gemini-embedding-2 returns its native width, which would not fit the
 * vector(768) column.
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = 'gemini'
  readonly modelName = env.GEMINI_EMBEDDING_MODEL
  readonly dimensions = EMBEDDING_DIMENSIONS

  constructor(private readonly apiKey: string) {}

  private async call<T>(method: string, body: unknown): Promise<T> {
    return withRateLimitRetry(async () => {
      const response = await fetch(
        `${API_BASE}/models/${this.modelName}:${method}?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        // Status first so withRateLimitRetry can spot 429/503. The URL is never
        // included — it carries the API key.
        throw new Error(`Gemini embeddings ${response.status}: ${detail.slice(0, 300)}`)
      }

      return (await response.json()) as T
    })
  }

  private request(text: string, taskType: TaskType) {
    return {
      model: `models/${this.modelName}`,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }
  }

  private assertWidth(values: number[], label: string): number[] {
    if (values.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `${this.modelName} returned ${values.length} dims for ${label}, expected ${EMBEDDING_DIMENSIONS}`,
      )
    }
    return values
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const out: number[][] = []

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE)

      const data = await this.call<{ embeddings?: EmbeddingValues[] }>('batchEmbedContents', {
        requests: batch.map((text) => this.request(text, 'RETRIEVAL_DOCUMENT')),
      })

      const embeddings = data.embeddings ?? []
      if (embeddings.length !== batch.length) {
        throw new Error(
          `Gemini returned ${embeddings.length} embeddings for ${batch.length} inputs`,
        )
      }

      embeddings.forEach((embedding, j) => {
        out.push(this.assertWidth(embedding.values, `batch item ${i + j}`))
      })
    }

    return out
  }

  async embedQuery(text: string): Promise<number[]> {
    const data = await this.call<{ embedding?: EmbeddingValues }>(
      'embedContent',
      this.request(text, 'RETRIEVAL_QUERY'),
    )

    const values = data.embedding?.values
    if (!values) throw new Error('Gemini returned no embedding for query')

    return this.assertWidth(values, 'query')
  }
}
