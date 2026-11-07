'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Boxes, Github, MessageSquareQuote, Network, Sparkles } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const FEATURES = [
  {
    icon: Boxes,
    title: 'Architecture & modules',
    desc: 'The high-level shape of the codebase, then every directory explained by what it is responsible for.',
  },
  {
    icon: MessageSquareQuote,
    title: 'Answers with citations',
    desc: 'Ask anything. Each claim links to the file and the exact line range it came from, so you can check it.',
  },
  {
    icon: Network,
    title: 'Dependency graph',
    desc: 'See how files and packages actually connect, laid out automatically.',
  },
]

export default function LandingPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')

  return (
    <main className="min-h-screen bg-background bg-grid">
      <div className="mx-auto flex max-w-4xl flex-col px-6 py-24 animate-fade-in">
        <div className="flex flex-col items-center text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3 text-primary" />
            No account needed for public repos
          </span>

          <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
            Understand any codebase
            <span className="block text-muted-foreground">in a few minutes</span>
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            Paste a GitHub repository. Get an architecture overview, module breakdowns, a dependency
            graph, and answers that cite the exact lines they came from.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              router.push(url.trim() ? `/repos?url=${encodeURIComponent(url.trim())}` : '/repos')
            }}
            className="mt-9 flex w-full max-w-lg flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Github className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="github.com/owner/repo"
                aria-label="GitHub repository URL"
                className="h-11 pl-9"
              />
            </div>
            <Button type="submit" size="lg">
              Analyze
              <ArrowRight />
            </Button>
          </form>

          <Link
            href="/repos"
            className={buttonVariants({ variant: 'link', size: 'sm', className: 'mt-3' })}
          >
            or browse your saved repositories
          </Link>
        </div>

        <div className="mt-24 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-card p-5">
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-3 text-sm font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
