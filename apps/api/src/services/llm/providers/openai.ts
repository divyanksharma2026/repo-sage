import OpenAI from 'openai'
import type { LLMResponse } from '@reposage/types'
import type { LLMProvider } from '../provider.js'

export class OpenAIProvider implements LLMProvider {
  readonly providerName = 'openai'
  readonly modelName = 'gpt-4o-mini'

  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async complete(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
    })

    const choice = response.choices[0]
    if (!choice) throw new Error('No completion returned')

    return {
      text: choice.message.content ?? '',
      provider: 'openai',
      model: this.modelName,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
      },
    }
  }

  async stream(
    prompt: string,
    systemPrompt: string | undefined,
    onChunk: (text: string) => void,
  ): Promise<LLMResponse> {
    const stream = await this.client.chat.completions.create({
      model: this.modelName,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
    })

    let fullText = ''
    let promptTokens = 0
    let completionTokens = 0

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? ''
      if (text) {
        fullText += text
        onChunk(text)
      }
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens
        completionTokens = chunk.usage.completion_tokens
      }
    }

    return {
      text: fullText,
      provider: 'openai',
      model: this.modelName,
      usage: { promptTokens, completionTokens },
    }
  }
}
