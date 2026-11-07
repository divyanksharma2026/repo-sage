export interface RepoAnalysisJobData {
  repositoryId: string
  /** null when an anonymous visitor triggered the analysis of a public repo. */
  userId: string | null
  owner: string
  name: string
  defaultBranch: string
  /** Absent for anonymous runs — the worker then falls back to GITHUB_PAT. */
  githubToken?: string
}

export interface SSEProgressEvent {
  jobId: string
  repositoryId: string
  progress: number
  currentStep: string
  status: 'FETCHING' | 'ANALYZING' | 'COMPLETED' | 'FAILED'
  errorMessage?: string
}
