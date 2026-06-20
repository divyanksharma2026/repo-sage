import { createAnalysisWorker } from './repo-analysis.js'

const worker = createAnalysisWorker()

console.log('Worker started, waiting for jobs...')

process.on('SIGTERM', async () => {
  await worker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await worker.close()
  process.exit(0)
})
