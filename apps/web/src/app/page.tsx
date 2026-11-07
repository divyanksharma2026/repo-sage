import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">RepoSage</h1>
          <p className="text-xl text-muted-foreground">
            Drop any public GitHub repository. Get instant architecture analysis, module
            breakdowns, and answers that cite the exact lines they came from.
          </p>
          <p className="text-sm text-muted-foreground">No account needed for public repos.</p>
        </div>

        <div className="flex gap-4 justify-center">
          <Link
            href="/repos"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Analyze a repository
          </Link>
          <a
            href="/api/auth/github"
            className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-lg font-medium hover:bg-accent transition-colors"
          >
            Sign in for private repos
          </a>
        </div>

        <div className="grid grid-cols-3 gap-6 pt-8">
          {[
            { title: 'Architecture Overview', desc: 'Understand the high-level structure in seconds' },
            { title: 'Grounded Q&A', desc: 'Every answer cites the file and line range it used' },
            { title: 'Dependency Graph', desc: 'Interactive visualization of how files connect' },
          ].map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-lg p-4 text-left">
              <h3 className="font-semibold text-sm text-foreground mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
