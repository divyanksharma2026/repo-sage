import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  LLM_PROVIDER: z.enum(['gemini', 'openai', 'groq']).default('gemini'),
  // Groq serves no embedding API, so semantic search has its own provider knob.
  EMBEDDING_PROVIDER: z.enum(['gemini', 'openai']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  // Google retires model ids without warning (gemini-2.0-flash and
  // text-embedding-004 both 404'd mid-project). Keeping these in env means the
  // next retirement is a one-line .env edit, not a code change and redeploy.
  GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
  // Must stay a model that can emit 768-dim vectors, to match code_chunks.embedding.
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-2'),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  API_URL: z.string().url().default('http://localhost:3001'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  GITHUB_PAT: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('Invalid environment variables:')
    console.error(result.error.flatten().fieldErrors)
    process.exit(1)
  }
  return result.data
}

export { envSchema }
