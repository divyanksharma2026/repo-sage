'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { useRepoRoute } from '@/hooks/use-repo'
import { RepoBackLink } from '@/components/repo-back-link'
import { useChat, type ChatMessage } from '@/hooks/use-chat'
import { api } from '@/lib/api-client'
import type { Citation } from '@reposage/types'

const EXAMPLE_QUESTIONS = [
  'How does authentication work?',
  'Where does the app talk to the database?',
  'What happens when a request comes in?',
  'How is configuration loaded?',
]

/** Renders a snippet with its real file line numbers, which is the whole point. */
function Snippet({ citation }: { citation: Citation }) {
  const lines = citation.snippet.split('\n')

  return (
    <pre className="text-xs font-mono overflow-x-auto bg-background rounded-md p-3 leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span className="select-none text-muted-foreground/60 pr-3 text-right w-10 shrink-0">
            {citation.startLine + i}
          </span>
          <span className="text-foreground whitespace-pre">{line}</span>
        </div>
      ))}
    </pre>
  )
}

function SourceCard({ citation, open, onToggle }: { citation: Citation; open: boolean; onToggle: () => void }) {
  return (
    <div id={`cite-${citation.ref}`} className="border border-border rounded-md overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
      >
        <span className="text-xs font-mono bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 shrink-0">
          {citation.ref}
        </span>
        <code className="text-xs font-mono text-foreground truncate">
          {citation.filePath}:{citation.startLine}-{citation.endLine}
        </code>
        <span className="ml-auto text-xs text-muted-foreground shrink-0">
          {(citation.score * 100).toFixed(0)}%
        </span>
        <span className="text-xs text-muted-foreground">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="border-t border-border p-2">
          <Snippet citation={citation} />
        </div>
      )}
    </div>
  )
}

/**
 * Turns `[3]` in the model's answer into a chip that opens source 3. A ref the
 * model made up (no matching citation) is left as plain text rather than
 * rendered as a working link.
 */
function AnswerText({
  text,
  citations,
  onCite,
}: {
  text: string
  citations: Citation[]
  onCite: (ref: number) => void
}) {
  const byRef = new Map(citations.map((c) => [c.ref, c]))
  const parts = text.split(/(\[\d+\])/g)

  return (
    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) => {
        const match = /^\[(\d+)\]$/.exec(part)
        const ref = match?.[1] ? Number(match[1]) : null

        if (ref === null || !byRef.has(ref)) return <Fragment key={i}>{part}</Fragment>

        return (
          <button
            key={i}
            onClick={() => onCite(ref)}
            title={byRef.get(ref)?.filePath}
            className="align-super text-[10px] font-mono bg-secondary text-secondary-foreground rounded px-1 mx-0.5 hover:bg-accent transition-colors"
          >
            {ref}
          </button>
        )
      })}
    </p>
  )
}

function AssistantMessage({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  const [openRefs, setOpenRefs] = useState<Set<number>>(new Set())
  const [showSources, setShowSources] = useState(false)

  const toggle = (ref: number) =>
    setOpenRefs((prev) => {
      const next = new Set(prev)
      if (next.has(ref)) next.delete(ref)
      else next.add(ref)
      return next
    })

  const revealSource = (ref: number) => {
    setShowSources(true)
    setOpenRefs((prev) => new Set(prev).add(ref))
    requestAnimationFrame(() => {
      document.getElementById(`cite-${ref}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  if (message.error) {
    return (
      <div className="bg-card border border-red-900/50 rounded-lg p-4">
        <p className="text-sm text-red-400">{message.error}</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <AnswerText text={message.content} citations={message.citations} onCite={revealSource} />
      {streaming && message.content.length === 0 && (
        <p className="text-sm text-muted-foreground animate-pulse">Searching the codebase...</p>
      )}
      {streaming && message.content.length > 0 && <span className="animate-pulse text-sm">▊</span>}

      {message.citations.length > 0 && (
        <div className="pt-1 space-y-2">
          <button
            onClick={() => setShowSources((s) => !s)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showSources ? '▾' : '▸'} {message.citations.length} sources
          </button>
          {showSources && (
            <div className="space-y-1.5">
              {message.citations.map((c) => (
                <SourceCard key={c.ref} citation={c} open={openRefs.has(c.ref)} onToggle={() => toggle(c.ref)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ChatPage() {
  const { repoId } = useRepoRoute()
  const { messages, streaming, ask, stop, reset } = useChat(repoId ?? '')
  const [input, setInput] = useState('')
  const [index, setIndex] = useState<{ indexed: boolean; chunks: number } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!repoId) return // still resolving owner/name → id
    api
      .get<{ indexed: boolean; chunks: number }>(`/repos/${repoId}/chat/status`)
      .then(setIndex)
      .catch(() => setIndex({ indexed: false, chunks: 0 }))
  }, [repoId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = (question: string) => {
    setInput('')
    void ask(question)
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center gap-4 shrink-0">
        <RepoBackLink />
        <h1 className="text-sm font-semibold">Ask this codebase</h1>
        {index && (
          <span className="text-xs text-muted-foreground">
            {index.indexed ? `${index.chunks} chunks indexed` : 'not indexed'}
          </span>
        )}
        {messages.length > 0 && (
          <button onClick={reset} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            Clear
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {index && !index.indexed && (
            <div className="bg-card border border-border rounded-lg p-4 text-sm text-muted-foreground">
              This repository has no search index yet. Re-run the analysis — the last stage builds it.
            </div>
          )}

          {messages.length === 0 && index?.indexed && (
            <div className="space-y-3 pt-8">
              <p className="text-sm text-muted-foreground">
                Every answer cites the exact file and line range it came from.
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => submit(q)}
                    className="text-xs bg-card border border-border rounded-full px-3 py-1.5 hover:border-ring hover:bg-accent transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="bg-secondary text-secondary-foreground text-sm rounded-lg px-4 py-2 max-w-[80%]">
                  {m.content}
                </p>
              </div>
            ) : (
              <AssistantMessage key={i} message={m} streaming={streaming && i === messages.length - 1} />
            ),
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(input)
        }}
        className="border-t border-border px-6 py-4 shrink-0"
      >
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this codebase..."
            disabled={streaming || index?.indexed === false}
            className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              className="bg-secondary text-secondary-foreground text-sm rounded-md px-4 hover:bg-accent transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || index?.indexed === false}
              className="bg-primary text-primary-foreground text-sm rounded-md px-4 disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              Ask
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
