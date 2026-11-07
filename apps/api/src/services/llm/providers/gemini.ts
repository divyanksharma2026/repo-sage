import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from '../../../config.js'
import { withRateLimitRetry } from '../../../lib/retry.js'
import type { LLMResponse } from '@reposage/types'
import type { LLMProvider } from '../provider.js'

export class GeminiProvider implements LLMProvider {
  readonly providerName = 'gemini'
  // From env: Google retires model ids without notice, and its newest free-tier
  // models return 503 "high demand" for long stretches. See GEMINI_MODEL.
  readonly modelName = env.GEMINI_MODEL

  private client: GoogleGenerativeAI

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey)
  }

  async complete(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    return withRateLimitRetry(async () => {
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
        provider: 'gemini' as const,
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

    // Only the handshake is retried. Once chunks start arriving the caller has
    // already emitted them downstream, so a retry there would duplicate output.
    const result = await withRateLimitRetry(() => model.generateContentStream(prompt))

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
