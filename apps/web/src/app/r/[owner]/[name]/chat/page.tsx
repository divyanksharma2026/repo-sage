'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  Database,
  Loader2,
  MessageSquareQuote,
  Search,
  Square,
  Trash2,
} from 'lucide-react'
import { useRepoRoute } from '@/hooks/use-repo'
import { useChat, type ChatMessage } from '@/hooks/use-chat'
import { RepoBackLink } from '@/components/repo-back-link'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'
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
    <pre className="scrollbar-thin overflow-x-auto rounded-md bg-background p-3 font-mono text-xs leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span className="w-10 shrink-0 select-none pr-3 text-right text-muted-foreground/50">
            {citation.startLine + i}
          </span>
          <span className="whitespace-pre text-foreground">{line}</span>
        </div>
      ))}
    </pre>
  )
}

function SourceCard({
  citation,
  open,
  onToggle,
}: {
  citation: Citation
  open: boolean
  onToggle: () => void
}) {
  return (
    <div id={`cite-${citation.ref}`} className="overflow-hidden rounded-md border border-border">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
      >
        {open ? (
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
        )}
        <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] text-primary">
          {citation.ref}
        </span>
        <code className="truncate font-mono text-xs">
          {citation.filePath}:{citation.startLine}-{citation.endLine}
        </code>
        <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {(citation.score * 100).toFixed(0)}%
        </span>
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
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
      {parts.map((part, i) => {
        const match = /^\[(\d+)\]$/.exec(part)
        const ref = match?.[1] ? Number(match[1]) : null

        if (ref === null || !byRef.has(ref)) return <Fragment key={i}>{part}</Fragment>

        return (
          <button
            key={i}
            onClick={() => onCite(ref)}
            title={byRef.get(ref)?.filePath}
            className="mx-0.5 rounded bg-primary/15 px-1 align-super font-mono text-[10px] text-primary transition-colors hover:bg-primary/25"
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
      <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>{message.error}</span>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4 animate-fade-in">
      {streaming && message.content.length === 0 ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Search className="size-3.5 animate-pulse text-primary" />
          Searching the codebase…
        </p>
      ) : (
        <AnswerText text={message.content} citations={message.citations} onCite={revealSource} />
      )}

      {streaming && message.content.length > 0 && (
        <span className="animate-pulse text-sm text-primary">▊</span>
      )}

      {message.citations.length > 0 && (
        <div className="space-y-2 pt-1">
          <button
            onClick={() => setShowSources((s) => !s)}
            aria-expanded={showSources}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {showSources ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            {message.citations.length} sources
          </button>
          {showSources && (
            <div className="space-y-1.5">
              {message.citations.map((c) => (
                <SourceCard
                  key={c.ref}
                  citation={c}
                  open={openRefs.has(c.ref)}
                  onToggle={() => toggle(c.ref)}
                />
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

  const disabled = index?.indexed === false

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center gap-4 border-b border-border px-6 py-3">
        <RepoBackLink />
        <div className="flex items-center gap-2">
          <MessageSquareQuote className="size-4 text-primary" />
          <h1 className="text-sm font-semibold">Ask this codebase</h1>
        </div>
        {index && (
          <Badge variant={index.indexed ? 'outline' : 'warning'}>
            <Database />
            {index.indexed ? `${index.chunks.toLocaleString()} chunks` : 'not indexed'}
          </Badge>
        )}
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} className="ml-auto">
            <Trash2 />
            Clear
          </Button>
        )}
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {disabled && (
            <EmptyState
              icon={Database}
              title="No search index yet"
              description="Re-run the analysis — the last stage chunks and embeds the code, which is what makes citations possible."
            />
          )}

          {messages.length === 0 && index?.indexed && (
            <div className="space-y-4 pt-8">
              <p className="text-sm text-muted-foreground">
                Every answer cites the exact file and line range it came from.
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => submit(q)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
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
                <p className="max-w-[80%] rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
                  {m.content}
                </p>
              </div>
            ) : (
              <AssistantMessage
                key={i}
                message={m}
                streaming={streaming && i === messages.length - 1}
              />
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
        className="shrink-0 border-t border-border px-6 py-4"
      >
        <div className="mx-auto flex max-w-3xl gap-2">
          <div className="relative flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this codebase…"
              aria-label="Your question"
              disabled={streaming || disabled}
              className={cn('h-10 pr-10')}
            />
            <CornerDownLeft className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
          </div>
          {streaming ? (
            <Button type="button" variant="secondary" size="lg" onClick={stop}>
              <Square />
              Stop
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={!input.trim() || disabled}>
              {streaming ? <Loader2 className="animate-spin" /> : <MessageSquareQuote />}
              Ask
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
