/** A slice of a source file, embedded and stored for semantic search. */
export interface CodeChunk {
  filePath: string
  /** 1-indexed, inclusive. */
  startLine: number
  /** 1-indexed, inclusive. */
  endLine: number
  content: string
  contentHash: string
}

/** A retrieved chunk, as shown to the model and cited back to the user. */
export interface Citation {
  /** 1-based position in the prompt's context list — what `[n]` refers to. */
  ref: number
  filePath: string
  startLine: number
  endLine: number
  snippet: string
  /** Cosine similarity in [0, 1]; higher is closer. */
  score: number
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  question: string
  history?: ChatTurn[]
}

/** SSE frames emitted by POST /repos/:id/chat, in order. */
export type ChatStreamEvent =
  | { type: 'sources'; citations: Citation[] }
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
