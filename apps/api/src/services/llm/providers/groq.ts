import Groq from 'groq-sdk'
import type { LLMResponse } from '@reposage/types'
import type { LLMProvider } from '../provider.js'

export class GroqProvider implements LLMProvider {
  readonly providerName = 'groq'
  readonly modelName = 'llama-3.1-8b-instant'

  private client: Groq

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey })
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
      provider: 'groq',
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
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
    })

    let fullText = ''

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? ''
      if (text) {
        fullText += text
        onChunk(text)
      }
    }

    return {
      text: fullText,
      provider: 'groq',
      model: this.modelName,
      usage: { promptTokens: 0, completionTokens: 0 },
    }
  }
}
