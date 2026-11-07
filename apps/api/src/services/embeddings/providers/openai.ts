import OpenAI from 'openai'
import { withRateLimitRetry } from '../../../lib/retry.js'
import { EMBEDDING_DIMENSIONS, type EmbeddingProvider } from '../provider.js'

/** Well inside OpenAI's per-request input cap, and small enough to retry cheaply. */
const BATCH_SIZE = 128

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = 'openai'
  readonly modelName = 'text-embedding-3-small'
  readonly dimensions = EMBEDDING_DIMENSIONS

  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await withRateLimitRetry(() =>
      this.client.embeddings.create({
        model: this.modelName,
        input: texts,
        // Matryoshka truncation — keeps this provider interchangeable with
        // Gemini against the same vector(768) column.
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    )

    if (response.data.length !== texts.length) {
      throw new Error(`OpenAI returned ${response.data.length} embeddings for ${texts.length} inputs`)
    }

    // The API documents `index`, but does not promise ordering of `data`.
    return [...response.data].sort((a, b) => a.index - b.index).map((d) => d.embedding)
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const out: number[][] = []
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      out.push(...(await this.embedBatch(texts.slice(i, i + BATCH_SIZE))))
    }
    return out
  }

  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text])
    if (!embedding) throw new Error('OpenAI returned no embedding for query')
    return embedding
  }
}
