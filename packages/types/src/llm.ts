export type LLMProviderName = 'gemini' | 'openai' | 'groq'

export interface LLMUsage {
  promptTokens: number
  completionTokens: number
}

export interface LLMResponse {
  text: string
  usage: LLMUsage
  provider: LLMProviderName
  model: string
}

export interface LLMStreamChunk {
  text: string
  done: boolean
}
