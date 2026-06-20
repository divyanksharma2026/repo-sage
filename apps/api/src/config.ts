import { config } from 'dotenv'
import { resolve } from 'path'
import { validateEnv } from '@reposage/config'

// Load from monorepo root .env
config({ path: resolve(process.cwd(), '../../.env') })
config({ path: resolve(process.cwd(), '.env') })

export const env = validateEnv()
