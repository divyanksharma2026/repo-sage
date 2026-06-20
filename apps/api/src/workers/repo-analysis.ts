import { Worker, type Job } from 'bullmq'
import { createRedisClient } from '../lib/redis.js'
import { prisma } from '../lib/prisma.js'
import { runAnalysis } from '../services/analysis/orchestrator.js'
import { publishProgress } from './sse-publisher.js'
import { REPO_ANALYSIS_QUEUE } from '../jobs/queue.js'
import type { RepoAnalysisJobData, SSEProgressEvent } from '@reposage/types'

export function createAnalysisWorker(): Worker {
  const connection = createRedisClient()
  const publisher = createRedisClient()

  const worker = new Worker<RepoAnalysisJobData>(
    REPO_ANALYSIS_QUEUE,
    async (job: Job<RepoAnalysisJobData>) => {
      const { repositoryId } = job.data

      await prisma.repository.update({
        where: { id: repositoryId },
        data: { status: 'FETCHING' },
      })

      await prisma.analysisJob.update({
        where: { repositoryId },
        data: { startedAt: new Date(), bullJobId: job.id },
      })

      const onProgress = async (progress: number, currentStep: string) => {
        await job.updateProgress(progress)

        await prisma.analysisJob.update({
          where: { repositoryId },
          data: {
            progress,
            currentStep,
            ...(progress >= 25 ? { } : {}),
          },
        })

        if (progress >= 25 && progress < 100) {
          await prisma.repository.update({
            where: { id: repositoryId },
            data: { status: 'ANALYZING' },
          })
        }

        const event: SSEProgressEvent = {
          jobId: job.id ?? '',
          repositoryId,
          progress,
          currentStep,
          status: progress === 100 ? 'COMPLETED' : progress >= 25 ? 'ANALYZING' : 'FETCHING',
        }

        await publishProgress(publisher, event)
      }

      try {
        await runAnalysis(job.data, onProgress)

        await prisma.analysisJob.update({
          where: { repositoryId },
          data: { progress: 100, completedAt: new Date(), currentStep: 'Completed' },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'

        await prisma.repository.update({
          where: { id: repositoryId },
          data: { status: 'FAILED' },
        })

        await prisma.analysisJob.update({
          where: { repositoryId },
          data: { errorMessage: message },
        })

        await publishProgress(publisher, {
          jobId: job.id ?? '',
          repositoryId,
          progress: 0,
          currentStep: 'Failed',
          status: 'FAILED',
          errorMessage: message,
        })

        throw error
      }
    },
    { connection, concurrency: 1, lockDuration: 300000 }, // 5 min lock — analysis can take a while
  )

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message)
  })

  return worker
}
