# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RepoSage — paste a GitHub repo URL, get an AI-generated architecture overview, per-module summaries, streamed file-level explanations, and an interactive dependency graph. Turborepo monorepo (npm workspaces).

## Commands

All from the repo root unless noted. There is **no test suite** in this project.

```bash
npm install                 # install all workspaces

docker compose up -d        # REQUIRED first: starts Postgres (5432) + Redis (6379)

npm run db:generate         # regenerate Prisma client after schema changes
npm run db:migrate          # apply migrations (turbo → packages/db)
npm run db:studio           # open Prisma Studio

npm run dev                 # turbo: runs API + web dev servers
npm run build               # turbo build (respects ^build dependency order)
npm run type-check          # turbo: tsc --noEmit across workspaces
npm run lint                # turbo lint
npm run format              # prettier --write
```

`npm run dev` (turbo) does **not** start the BullMQ worker. The worker is a separate process and must be run by hand, or analysis jobs will queue forever and never execute:

```bash
cd apps/api && npm run worker     # tsx watch src/workers/index.ts
```

To run just one app's dev server: `cd apps/api && npm run dev` (port 3001) or `cd apps/web && npm run dev` (port 3000).

## The three processes

This system is **three independent processes** that communicate through Postgres and Redis — understanding this split is essential:

1. **API** (`apps/api`, Fastify, port 3001) — REST + SSE endpoints. Enqueues jobs; does not run analysis.
2. **Worker** (`apps/api/src/workers/index.ts`, BullMQ) — consumes the `repo-analysis` queue and runs the actual LLM analysis. Separate process, started manually.
3. **Web** (`apps/web`, Next.js 15 / React 19, port 3000) — proxies `/api/*` → `http://localhost:3001` via `next.config.ts` rewrites, so the browser only ever talks to port 3000.

## Analysis pipeline (the core flow)

When a repo is added and analyzed:

1. `POST /repos` (`routes/repos.ts`) → fetch GitHub metadata via Octokit, create `Repository` row.
2. `POST /repos/:id/analyze` (`routes/analyze.ts`) → enqueue a BullMQ job with deterministic `jobId: repo-<repoId>` (any stale job with that ID is removed first), set status `PENDING`.
3. Worker (`workers/repo-analysis.ts`) picks it up and calls `runAnalysis` (`services/analysis/orchestrator.ts`), the 6-stage heart of the system, reporting progress via an `onProgress(percent, step)` callback:
   - 5% fetch file tree → 15% select & fetch key files (parallel, 8s timeout each) → 25% LLM architecture overview → 40% LLM module summaries (sequential, 1s delay between calls to respect rate limits) → 70% build dependency graph → 100% complete.
4. `onProgress` writes to the `AnalysisJob` row AND publishes a JSON event to Redis pub/sub channel `sse:repo:<id>` (`workers/sse-publisher.ts`).
5. `GET /repos/:id/status` (`routes/sse.ts`) subscribes to that Redis channel and relays events to the browser as SSE; `apps/web` consumes them via the `useSSE` hook to drive the progress bar.

Status enum lifecycle: `PENDING → FETCHING → ANALYZING → COMPLETED | FAILED`.

## LLM provider abstraction

`services/llm/` defines an `LLMProvider` interface (`complete()` + `stream()`) with three implementations: **Gemini** (`gemini-2.0-flash`, the default), **OpenAI** (`gpt-4o-mini`), **Groq** (`llama-3.1-8b-instant`). `factory.ts` is a lazy singleton selected by the `LLM_PROVIDER` env var. To add a provider: implement the interface, register it in the factory switch, extend the `LLM_PROVIDER` enum in `packages/config`.

Prompts (`services/llm/prompts.ts`) instruct the model to return raw JSON. Callers defensively parse: regex-extract the first `{...}` block, strip ``` ```json ``` fences, then `JSON.parse` inside a try/catch that falls back to treating the raw text as the `overview`/`explanation`. Preserve this pattern — model output is not guaranteed to be clean JSON.

Note: README says Groq but `.env.example` and `packages/config` default `LLM_PROVIDER` to `gemini`.

## Caching (two-tier, content-addressed)

File explanations are keyed by **SHA-256 of file content**, not by path — identical content is never re-explained.

- `GET /repos/:id/files/explain` (`routes/explain.ts`) checks **Postgres `FileExplanation`** (unique on `repositoryId + contentHash`), then **Redis** (`file:explanation:<hash>`, 7-day TTL), and only then streams from the LLM. Cached hits are still emitted as a single SSE `done` event so the frontend rendering path is uniform.
- Graph responses are Redis-cached per repo (`repo:graph:<id>`).

`services/cache/redis-cache.ts` holds the key builders and TTL.

## Dependency graph

`services/analysis/graph.ts` builds the graph with **regex-based import extraction** (separate patterns for JS/TS, Python, Go — no real AST despite the README's wording). Relative imports are resolved against a set of candidate paths (`.ts`/`.js`/`/index.ts` etc.) to internal `FILE` nodes (`IMPORTS` edges); bare specifiers become `EXTERNAL_PACKAGE` nodes (`DEPENDS_ON` edges). Capped at 80 non-vendor files. Persisted by deleting + recreating all nodes/edges in one transaction. Frontend (`app/repos/[repoId]/graph/page.tsx`) lays it out with dagre and renders via `@xyflow/react`.

## Auth

GitHub OAuth (`routes/auth.ts`), server-side sessions stored in Postgres (`Session` table, 30-day expiry), session token in an httpOnly `session` cookie. `plugins/auth.ts` decorates `app.authenticate`; the `requireAuth` preHandler (`middleware/require-auth.ts`) attaches `request.user`. The user's GitHub token is stored on the `User` row and reused for all Octokit calls (so analysis runs with the user's own rate limits); it is stripped from `/auth/me` responses.

## Packages

- `packages/db` — Prisma schema + generated client; exported as `@reposage/db` (also re-exports model types like `User`).
- `packages/config` — zod-validated env (`validateEnv()`), single source of truth for env vars; `process.exit(1)` on invalid env.
- `packages/types` — shared TS types (`@reposage/types`); the API/DB enums and these hand-written types must be kept in sync manually.

## Conventions / gotchas

- **ESM throughout** (`"type": "module"`, `moduleResolution: NodeNext`). Relative imports in `apps/api` must use explicit `.js` extensions even though the source is `.ts` — match the existing imports.
- TS is strict, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` — array indexing yields `T | undefined` and optional props need care.
- `apps/api/src/config.ts` loads `.env` from the **monorepo root**, not per-app. There is one `.env` at the repo root.
- Plugin registration order in `app.ts` matters: db/redis → auth → rate-limit.
- The single root `.env` is shared by all processes (it's a turbo `globalDependency`).
