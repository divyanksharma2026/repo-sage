export interface RepoAnalysisJobData {
  repositoryId: string
  userId: string
  owner: string
  name: string
  defaultBranch: string
  githubToken: string
}

export interface SSEProgressEvent {
  jobId: string
  repositoryId: string
  progress: number
  currentStep: string
  status: 'FETCHING' | 'ANALYZING' | 'COMPLETED' | 'FAILED'
  errorMessage?: string
}
