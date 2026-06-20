export interface Architecture {
  id: string
  repositoryId: string
  overview: string
  techStack: string[]
  patterns: string[]
  entryPoints: string[]
  llmProvider: string
  llmModel: string
}

export interface Module {
  id: string
  repositoryId: string
  name: string
  path: string
  summary: string
  responsibility: string
  fileCount: number
  language: string | null
  exports: string[]
  imports: string[]
}

export interface KeyFunction {
  name: string
  description: string
}

export interface FileExplanation {
  id: string
  repositoryId: string
  filePath: string
  contentHash: string
  explanation: string
  purpose: string
  keyFunctions: KeyFunction[]
  dependencies: string[]
}

export interface AnalysisJob {
  id: string
  repositoryId: string
  bullJobId: string | null
  progress: number
  currentStep: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
}
