'use client'

import { useCallback, useRef, useState } from 'react'
import type { Citation, ChatStreamEvent, ChatTurn } from '@reposage/types'

const API_BASE = '/api'
/** Turns sent back as context. The server trims to its own limit too. */
const HISTORY_TURNS = 6

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  citations: Citation[]
  error: string | null
}

export function useChat(repoId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  /** Mutates only the trailing assistant message, which `ask` just pushed. */
  const updateLast = useCallback((patch: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      if (!last || last.role !== 'assistant') return prev
      return [...prev.slice(0, -1), patch(last)]
    })
  }, [])

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || streaming) return

      const history: ChatTurn[] = messages
        .filter((m) => m.error === null && m.content.length > 0)
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role, content: m.content }))

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: trimmed, citations: [], error: null },
        { role: 'assistant', content: '', citations: [], error: null },
      ])
      setStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(`${API_BASE}/repos/${repoId}/chat`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: trimmed, history }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          // Errors before the stream opens come back as plain JSON.
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          updateLast((m) => ({ ...m, error: body?.error ?? `Request failed (${res.status})` }))
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            let event: ChatStreamEvent
            try {
              event = JSON.parse(line.slice(6)) as ChatStreamEvent
            } catch {
              continue // malformed frame, skip
            }

            switch (event.type) {
              case 'sources':
                updateLast((m) => ({ ...m, citations: event.citations }))
                break
              case 'token':
                updateLast((m) => ({ ...m, content: m.content + event.text }))
                break
              case 'error':
                updateLast((m) => ({ ...m, error: event.message }))
                break
              case 'done':
                break
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        updateLast((m) => ({ ...m, error: err instanceof Error ? err.message : 'Request failed' }))
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    },
    [repoId, messages, streaming, updateLast],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setStreaming(false)
  }, [])

  return { messages, streaming, ask, stop, reset }
}
