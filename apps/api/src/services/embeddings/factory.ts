import { env } from '../../config.js'
import { EMBEDDING_DIMENSIONS, type EmbeddingProvider } from './provider.js'
import { GeminiEmbeddingProvider } from './providers/gemini.js'
import { OpenAIEmbeddingProvider } from './providers/openai.js'

let instance: EmbeddingProvider | null = null

/**
 * Lazy singleton, same shape as the LLM factory. Note this is selected by
 * EMBEDDING_PROVIDER, not LLM_PROVIDER: Groq serves no embedding API, so a
 * Groq setup still needs a Gemini or OpenAI key for search.
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (instance) return instance

  switch (env.EMBEDDING_PROVIDER) {
    case 'gemini':
      if (!env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is required for the gemini embedding provider')
      }
      instance = new GeminiEmbeddingProvider(env.GEMINI_API_KEY)
      break
    case 'openai':
      if (!env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required for the openai embedding provider')
      }
      instance = new OpenAIEmbeddingProvider(env.OPENAI_API_KEY)
      break
    default:
      throw new Error(`Unknown EMBEDDING_PROVIDER: ${env.EMBEDDING_PROVIDER}`)
  }

  if (instance.dimensions !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `${instance.providerName} emits ${instance.dimensions}-dim vectors, but code_chunks.embedding is vector(${EMBEDDING_DIMENSIONS})`,
    )
  }

  return instance
}
