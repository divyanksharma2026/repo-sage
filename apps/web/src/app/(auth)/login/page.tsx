export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">Sign in to RepoSage</h1>
        <a
          href="/api/auth/github"
          className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90"
        >
          Continue with GitHub
        </a>
      </div>
    </div>
  )
}
