import Link from 'next/link'
import { ArrowLeft, Github } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background bg-grid px-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-8 text-center animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Sign in to RepoSage</h1>
          <p className="text-sm text-muted-foreground">
            Only needed for private repositories and a saved list — public repos work without an
            account.
          </p>
        </div>

        <a href="/api/auth/github" className={buttonVariants({ size: 'lg', className: 'w-full' })}>
          <Github />
          Continue with GitHub
        </a>

        <Link
          href="/repos"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back to repositories
        </Link>
      </div>
    </main>
  )
}
