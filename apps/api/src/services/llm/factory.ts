import { env } from '../../config.js'
import type { LLMProvider } from './provider.js'
import { GeminiProvider } from './providers/gemini.js'
import { OpenAIProvider } from './providers/openai.js'
import { GroqProvider } from './providers/groq.js'

let instance: LLMProvider | null = null

export function getLLMProvider(): LLMProvider {
  if (instance) return instance

  switch (env.LLM_PROVIDER) {
    case 'gemini':
      if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required for gemini provider')
      instance = new GeminiProvider(env.GEMINI_API_KEY)
      break
    case 'openai':
      if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for openai provider')
      instance = new OpenAIProvider(env.OPENAI_API_KEY)
      break
    case 'groq':
      if (!env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is required for groq provider')
      instance = new GroqProvider(env.GROQ_API_KEY)
      break
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${env.LLM_PROVIDER}`)
  }

  return instance
}
