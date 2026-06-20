import type { LLMResponse } from '@reposage/types'

export interface LLMProvider {
  complete(prompt: string, systemPrompt?: string): Promise<LLMResponse>
  stream(
    prompt: string,
    systemPrompt: string | undefined,
    onChunk: (text: string) => void,
  ): Promise<LLMResponse>
  readonly providerName: string
  readonly modelName: string
}
