import { Queue } from 'bullmq'
import { createRedisClient } from '../lib/redis.js'
import type { RepoAnalysisJobData } from '@reposage/types'

export const REPO_ANALYSIS_QUEUE = 'repo-analysis'

let queue: Queue<RepoAnalysisJobData> | null = null

export function getAnalysisQueue(): Queue<RepoAnalysisJobData> {
  if (!queue) {
    queue = new Queue<RepoAnalysisJobData>(REPO_ANALYSIS_QUEUE, {
      connection: createRedisClient(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    })
  }
  return queue
}
