/**
 * Fixed by the `vector(768)` column on code_chunks. Every provider registered
 * in the factory must emit vectors of exactly this width, or the insert fails
 * at the database rather than silently storing something unsearchable.
 */
export const EMBEDDING_DIMENSIONS = 768

export interface EmbeddingProvider {
  /** Embeds stored passages. Batches internally; preserves input order. */
  embedDocuments(texts: string[]): Promise<number[][]>
  /**
   * Embeds a search query. Kept separate from embedDocuments because the
   * providers ask for a different task hint on each side, which measurably
   * improves retrieval.
   */
  embedQuery(text: string): Promise<number[]>
  readonly providerName: string
  readonly modelName: string
  readonly dimensions: number
}
