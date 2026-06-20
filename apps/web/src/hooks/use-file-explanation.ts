'use client'

import { useState, useCallback } from 'react'

const API_BASE = '/api'

export function useFileExplanation(repoId: string) {
  const [text, setText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [done, setDone] = useState(false)

  const explain = useCallback(
    async (filePath: string) => {
      setText('')
      setDone(false)
      setStreaming(true)

      try {
        const res = await fetch(
          `${API_BASE}/repos/${repoId}/files/explain?path=${encodeURIComponent(filePath)}`,
          { credentials: 'include' },
        )

        if (!res.ok || !res.body) {
          setStreaming(false)
          setText('Failed to load explanation.')
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const chunk = JSON.parse(line.slice(6)) as { text: string; done: boolean }
              if (chunk.text) setText((prev) => prev + chunk.text)
              if (chunk.done) {
                setStreaming(false)
                setDone(true)
              }
            } catch {
              // malformed chunk, skip
            }
          }
        }
      } catch {
        setText('Failed to load explanation.')
      } finally {
        setStreaming(false)
      }
    },
    [repoId],
  )

  return { text, streaming, done, explain }
}
