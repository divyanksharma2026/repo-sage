'use client'

import { useEffect, useRef, useState } from 'react'

interface SSEOptions<T> {
  url: string
  enabled?: boolean
  onMessage?: (data: T) => void
}

export function useSSE<T>({ url, enabled = true, onMessage }: SSEOptions<T>) {
  const [lastEvent, setLastEvent] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!enabled) return

    const es = new EventSource(url, { withCredentials: true })
    esRef.current = es

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as T
        setLastEvent(data)
        setError(null)
        onMessageRef.current?.(data)
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      setError('SSE connection lost')
    }

    return () => {
      es.close()
    }
  }, [url, enabled])

  return { lastEvent, error }
}
