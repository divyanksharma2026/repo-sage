# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RepoSage — paste a GitHub repo URL, get an AI-generated architecture overview, per-module summaries, streamed file-level explanations, an interactive dependency graph, and a grounded Q&A chat that cites exact file line ranges. Turborepo monorepo (npm workspaces).

## Commands

All from the repo root unless noted. There is **no test suite** in this project.

```bash
npm install                 # install all workspaces

docker compose up -d        # REQUIRED first: starts Postgres (5432) + Redis (6379)
                            # Postgres is pgvector/pgvector:pg16 — the `vector`
                            # extension is required by the code_chunks table.

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

1. `POST /repos` (`routes/repos.ts`) → if a `Repository` with that `fullName` already exists it is **reused, not re-analyzed** (that shared result is what makes the second request for a popular repo free); otherwise fetch GitHub metadata via Octokit and create the row. Signed-in callers also get a `UserRepository` row.
2. `POST /repos/:id/analyze` (`routes/analyze.ts`) → enqueue a BullMQ job with deterministic `jobId: repo-<repoId>` (any stale job with that ID is removed first), set status `PENDING`.
3. Worker (`workers/repo-analysis.ts`) picks it up and calls `runAnalysis` (`services/analysis/orchestrator.ts`), the 7-stage heart of the system, reporting progress via an `onProgress(percent, step)` callback:
   - 5% fetch file tree → 15% select & fetch key files (parallel, 8s timeout each) → 25% LLM architecture overview → 40% LLM module summaries (sequential, 1s delay between calls to respect rate limits) → 70% build dependency graph → 88% chunk & embed for search → 100% complete.
   - The indexing stage is wrapped in try/catch on purpose: a missing or rate-limited embedding key costs the repo its chat feature, not its whole analysis.
4. `onProgress` writes to the `AnalysisJob` row AND publishes a JSON event to Redis pub/sub channel `sse:repo:<id>` (`workers/sse-publisher.ts`).
5. `GET /repos/:id/status` (`routes/sse.ts`) subscribes to that Redis channel and relays events to the browser as SSE; `apps/web` consumes them via the `useSSE` hook to drive the progress bar. It subscribes **before** sending the current-state snapshot and buffers anything that arrives in between, so no event is lost and progress stays monotonic.

Frontend routing: a repository lives at `/r/<owner>/<name>` so the link is shareable and guessable. `useRepoRoute` (`hooks/use-repo.ts`) resolves that to the internal id via `GET /repos/by/:owner/:name`; sub-resource endpoints still take the id, so `repoId` is null until the resolve lands — guard effects on it.

Status enum lifecycle: `PENDING → FETCHING → ANALYZING → COMPLETED | FAILED`.

## LLM provider abstraction

`services/llm/` defines an `LLMProvider` interface (`complete()` + `stream()`) with three implementations: **Gemini** (the default), **OpenAI** (`gpt-4o-mini`), **Groq** (`llama-3.1-8b-instant`). `factory.ts` is a lazy singleton selected by the `LLM_PROVIDER` env var.

**Gemini model ids live in env, not in code** (`GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`). Google retires ids without notice — `gemini-2.0-flash` and `text-embedding-004` both started returning 404 mid-project — and its newest free-tier models return `503 "high demand"` for long stretches. To see what a key can actually use:

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"
```

`withRateLimitRetry` (`lib/retry.ts`) therefore retries 503/overload as well as 429, with 5s/10s/20s backoff — long enough to outlast a per-minute quota reset. In `GeminiProvider.stream()` only the *handshake* is retried: once chunks have been handed to `onChunk` the caller has already forwarded them, so retrying would duplicate output. To add a provider: implement the interface, register it in the factory switch, extend the `LLM_PROVIDER` enum in `packages/config`. Embeddings are a **separate** abstraction with the same shape — see "Semantic search & grounded chat" below.

Prompts (`services/llm/prompts.ts`) instruct the model to return raw JSON. Callers defensively parse: regex-extract the first `{...}` block, strip ``` ```json ``` fences, then `JSON.parse` inside a try/catch that falls back to treating the raw text as the `overview`/`explanation`. Preserve this pattern — model output is not guaranteed to be clean JSON.

Note: README says Groq but `.env.example` and `packages/config` default `LLM_PROVIDER` to `gemini`.

## Semantic search & grounded chat

The chat feature is retrieval-augmented, and its whole value is that answers are traceable, so the line arithmetic has to stay exact.

- `services/chunking/chunker.ts` — line-aware chunking. Greedily packs **whole lines** up to ~1400 chars with a 3-line overlap, so every chunk carries an exact 1-indexed, inclusive `[startLine, endLine]`. **Invariant: `chunk.content === fileLines.slice(startLine - 1, endLine).join('\n')`.** Citations are built from that range, so breaking it makes the product lie. `shouldIndexFile` drops minified files, `.d.ts`, lockfiles, and anything whose mean line length suggests generated code.
- `services/embeddings/` — an `EmbeddingProvider` interface (`embedDocuments` + `embedQuery`, split because providers want a different task hint per side) with Gemini (`GEMINI_EMBEDDING_MODEL`, default `gemini-embedding-2`) and OpenAI (`text-embedding-3-small`, truncated via the `dimensions` param). Selected by `EMBEDDING_PROVIDER`, **not** `LLM_PROVIDER` — Groq serves no embedding API, so a Groq setup still needs a Gemini or OpenAI key for search. All providers must emit **768 dims** to match the column; the factory asserts this.
  - The Gemini embedder calls **REST directly rather than the SDK**, because `@google/generative-ai`'s `EmbedContentRequest` has no `outputDimensionality` field — and without it the model returns its native width (3072), which will not fit `vector(768)`.
  - Model choice matters here: truncating `gemini-embedding-001` to 768 returns **unnormalized** vectors (L2 ≈ 0.59), while `gemini-embedding-2` returns L2 = 1.0. Cosine distance normalizes anyway, so both retrieve correctly, but anything that later switches to `<->` or `<#>` would silently break on unnormalized vectors.
- `services/search/indexer.ts` — embeds first, **then** deletes + inserts in one transaction, so a failure part-way leaves the previous index intact instead of wiping it. Uses `$executeRaw` because Prisma cannot write `Unsupported("vector(768)")`.
- `services/search/retrieve.ts` — `$queryRaw` with pgvector's `<=>` (cosine distance); `score = 1 - distance`. Caps results at 3 per file so one long file cannot fill every slot. **No score floor on purpose** — a threshold tuned for one embedding model silently returns nothing under another.
- `POST /repos/:id/chat` (`routes/chat.ts`) — POST, not GET, because the question and history go in the body, so the browser uses `fetch` + `ReadableStream` rather than `EventSource`. Emits a `sources` frame first, then `token` frames, then `done`. `GET /repos/:id/chat/status` reports whether an index exists.
- `CHAT_SYSTEM_PROMPT` (`services/llm/prompts.ts`) is the one prompt that does **not** ask for JSON — it asks for markdown with `[n]` citations. The frontend maps `[n]` back to the nth retrieved chunk and renders the snippet with real line numbers; a `[n]` the model invents (no matching chunk) stays plain text rather than becoming a broken link.

Note: no HNSW/IVFFlat index on `code_chunks`. A repo indexes a few hundred chunks, which Postgres scans exactly in milliseconds, and an index type Prisma cannot model would surface as schema drift on the next `prisma migrate dev`. Add one past ~10k chunks per repo.

## Caching (two-tier, content-addressed)

File explanations are keyed by **SHA-256 of file content**, not by path — identical content is never re-explained.

- `GET /repos/:id/files/explain` (`routes/explain.ts`) checks **Postgres `FileExplanation`** (unique on `repositoryId + contentHash`), then **Redis** (`file:explanation:<hash>`, 7-day TTL), and only then streams from the LLM. Cached hits are still emitted as a single SSE `done` event so the frontend rendering path is uniform.
- Graph responses are Redis-cached per repo (`repo:graph:<id>`).

`services/cache/redis-cache.ts` holds the key builders and TTL.

## Dependency graph

`services/analysis/graph.ts` builds the graph with **regex-based import extraction** (separate patterns for JS/TS, Python, Go — no real AST despite the README's wording). Relative imports are resolved against a set of candidate paths (`.ts`/`.js`/`/index.ts` etc.) to internal `FILE` nodes (`IMPORTS` edges); bare specifiers become `EXTERNAL_PACKAGE` nodes (`DEPENDS_ON` edges). Capped at 80 non-vendor files. Persisted by deleting + recreating all nodes/edges in one transaction. Frontend (`app/repos/[repoId]/graph/page.tsx`) lays it out with dagre and renders via `@xyflow/react`.

## Auth

**Public repositories need no account.** That is the product's main affordance, so don't quietly re-add `requireAuth` to a read route.

GitHub OAuth (`routes/auth.ts`), server-side sessions in Postgres (`Session`, 30-day expiry), token in an httpOnly `session` cookie. `plugins/auth.ts` decorates `app.authenticate`.

Two preHandlers:
- `requireAuth` (`middleware/require-auth.ts`) — rejects anonymous callers, sets `request.user`. Used only by `GET /repos` (your saved list) and `DELETE /repos/:id`.
- `optionalAuth` (`middleware/optional-auth.ts`) — resolves a session if present, never rejects, sets `request.currentUser` (nullable). Everything else uses this and then gates on the repository itself.

**Access model** (`lib/access.ts`): a `Repository` row is global, one per `fullName`, not per user.
- `isPrivate === false` → readable by anyone, signed in or not.
- `isPrivate === true` → readable only by users holding a `UserRepository` row, which is written only after GitHub itself confirmed the user can read the repo (`POST /repos` re-fetches metadata with their token). GitHub stays the source of truth; we cache its answer.
- `assertRepoAccess` throws **NotFound, never Unauthorized**, so outsiders cannot probe which private repos exist. Keep it that way.
- `githubTokenFor` picks the credential: a signed-in user's own token when available (their 5000/hr), else `GITHUB_PAT`. **Anonymous analysis requires `GITHUB_PAT`** — one run makes 100+ GitHub calls and the unauthenticated budget is 60/hr, so `analyze` returns 503 without it.

`DELETE /repos/:id` removes your `UserRepository` row only. The analysis is shared, so one person removing it must not delete it for everyone.

Known trade-off: OAuth still requests the broad `repo` scope, because signing in is now mostly for private repos. If login is ever needed for something else, split this into a second consent step.

**Rate limiting** (`lib/rate-limits.ts`): per-IP budgets on the routes that cost money (`analyze` 3/hr, `chat` and `explain` 20/hr, `addRepo` 10/hr). Keyed by IP, not session — a session cookie is trivial to rotate, so keying on it would hand anyone an unlimited budget. The error handler in `app.ts` must keep passing through 4xx statuses, or the rate limiter's 429 turns back into a 500.

## Packages

- `packages/db` — Prisma schema + generated client; exported as `@reposage/db` (also re-exports model types like `User`).
- `packages/config` — zod-validated env (`validateEnv()`), single source of truth for env vars; `process.exit(1)` on invalid env.
- `packages/types` — shared TS types (`@reposage/types`); the API/DB enums and these hand-written types must be kept in sync manually.

## Conventions / gotchas

- **ESM throughout** (`"type": "module"`, `moduleResolution: NodeNext`). Relative imports in `apps/api` must use explicit `.js` extensions even though the source is `.ts` — match the existing imports.
- TS is strict, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` — array indexing yields `T | undefined` and optional props need care.
- `apps/api/src/config.ts` loads `.env` from the **monorepo root**, not per-app. There is one `.env` at the repo root.
- The Prisma CLI does **not** search parent directories for `.env` — it only looks in its own cwd (`packages/db`) and `prisma/`. `turbo.json`'s `globalDependencies: [".env"]` only affects cache hashing, it injects nothing. So every `packages/db` script that needs a live connection (`db:migrate`, `db:push`, `db:studio`) is wrapped in `dotenv -e ../../.env --`. `db:generate` is deliberately left unwrapped so a fresh clone with no `.env` can still generate the client.
- Plugin registration order in `app.ts` matters: db/redis → auth → rate-limit.
- The single root `.env` is shared by all processes (it's a turbo `globalDependency`).
