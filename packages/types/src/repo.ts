export type AnalysisStatus = 'PENDING' | 'FETCHING' | 'ANALYZING' | 'COMPLETED' | 'FAILED'

export interface Repository {
  id: string
  userId: string
  githubUrl: string
  owner: string
  name: string
  fullName: string
  defaultBranch: string
  description: string | null
  language: string | null
  stars: number
  isPrivate: boolean
  status: AnalysisStatus
  analyzedAt: string | null
  createdAt: string
}

export interface RepositoryListItem
  extends Pick<Repository, 'id' | 'fullName' | 'description' | 'language' | 'stars' | 'status' | 'analyzedAt'> {}

export interface User {
  id: string
  login: string
  name: string | null
  avatarUrl: string | null
}
