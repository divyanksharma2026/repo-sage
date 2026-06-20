import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LLMResponse } from '@reposage/types'
import type { LLMProvider } from '../provider.js'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('retry')
      if (isRateLimit && i < retries - 1) {
        const delay = 15000 * (i + 1) // 15s, 30s, 45s
        console.log(`Rate limited. Retrying in ${delay / 1000}s...`)
        await sleep(delay)
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}

export class GeminiProvider implements LLMProvider {
  readonly providerName = 'gemini'
  readonly modelName = 'gemini-2.0-flash'

  private client: GoogleGenerativeAI

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey)
  }

  async complete(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    return withRetry(async () => {
      const model = this.client.getGenerativeModel({
        model: this.modelName,
        ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
      })

      const result = await model.generateContent(prompt)
      const response = result.response
      const text = response.text()
      const usage = response.usageMetadata

      return {
        text,
        provider: 'gemini',
        model: this.modelName,
        usage: {
          promptTokens: usage?.promptTokenCount ?? 0,
          completionTokens: usage?.candidatesTokenCount ?? 0,
        },
      }
    })
  }

  async stream(
    prompt: string,
    systemPrompt: string | undefined,
    onChunk: (text: string) => void,
  ): Promise<LLMResponse> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    })

    const result = await model.generateContentStream(prompt)
    let fullText = ''

    for await (const chunk of result.stream) {
      const chunkText = chunk.text()
      fullText += chunkText
      onChunk(chunkText)
    }

    const finalResponse = await result.response
    const usage = finalResponse.usageMetadata

    return {
      text: fullText,
      provider: 'gemini',
      model: this.modelName,
      usage: {
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
      },
    }
  }
}
