# RepoSage

AI-powered codebase onboarding tool. Drop a GitHub repository URL and get an instant architecture overview, module-by-module breakdown, file-level explanations, and an interactive dependency graph — all powered by an LLM.

Built as a portfolio project to demonstrate production-grade backend engineering: async job queues, server-sent events, LLM provider abstraction, content-addressed caching, and static dependency graph analysis.

---

## Features

- **Architecture Analysis** — high-level overview, tech stack detection, entry points, and patterns
- **Module Summaries** — per-directory responsibility breakdown with exports and imports
- **File Explorer** — clickable file tree with on-demand AI explanations streamed token-by-token
- **Dependency Graph** — interactive react-flow visualization with dagre auto-layout
- **GitHub OAuth** — sign in, add any public repo, track analysis progress in real time
- **Smart Caching** — file explanations cached by content hash (SHA-256), so repeated views are instant

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + npm workspaces |
| API | Fastify + TypeScript |
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Database | PostgreSQL via Prisma ORM |
| Cache / Queue | Redis + BullMQ |
| LLM | Groq (`llama-3.1-8b-instant`) — swappable via env var |
| Graph | react-flow + dagre |
| Auth | GitHub OAuth + server-side sessions |

---

## Architecture

```
reposage/
├── apps/
│   ├── api/          # Fastify backend
│   │   ├── routes/   # auth, repos, analyze, SSE, explain, graph
│   │   ├── services/ # LLM providers, GitHub fetcher, analysis orchestrator
│   │   └── workers/  # BullMQ worker + SSE publisher
│   └── web/          # Next.js frontend
│       ├── app/      # App Router pages
│       └── hooks/    # useRepo, useSSE, useFileExplanation
└── packages/
    ├── db/           # Prisma schema + client
    ├── types/        # Shared TypeScript types
    └── config/       # Env validation (zod)
```

**Analysis pipeline:**
1. GitHub file tree fetched via Octokit (node_modules filtered out)
2. Key files selected and fetched in parallel (8s timeout per file)
3. LLM called for architecture overview → module summaries (sequential with delay to respect rate limits)
4. Static AST-based dependency graph built from import extraction
5. Progress streamed to frontend via SSE throughout

---

## Local Setup

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- A [GitHub OAuth App](https://github.com/settings/applications/new) (Homepage: `http://localhost:3000`, Callback: `http://localhost:3001/auth/callback`)
- A [Groq API key](https://console.groq.com) (free tier, 20k TPM)

### 1. Clone and install

```bash
git clone https://github.com/divyanksharma2026/repo-sage.git
cd repo-sage
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
SESSION_SECRET=any-random-32-char-string
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key
```

### 3. Start infrastructure

```bash
docker compose up -d
```

### 4. Run database migrations

```bash
cd packages/db
npx prisma migrate deploy
cd ../..
```

### 5. Start the services

Open three terminals:

```bash
# Terminal 1 — API server
cd apps/api && npm run dev

# Terminal 2 — BullMQ worker
cd apps/api && npm run worker

# Terminal 3 — Next.js frontend
cd apps/web && npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with GitHub, paste a repo URL, and watch the analysis run.

---

## LLM Providers

Switch providers by changing `LLM_PROVIDER` in `.env`:

| Value | Model | Notes |
|---|---|---|
| `groq` | llama-3.1-8b-instant | Free tier, 20k TPM — recommended for dev |
| `gemini` | gemini-2.0-flash | Free tier with daily quota |
| `openai` | gpt-4o-mini | Paid |

---

## How It Works

### Job Queue

Analysis is kicked off as a BullMQ job so the HTTP request returns immediately. The worker processes jobs one at a time (`concurrency: 1`) with a 5-minute lock to handle long-running LLM calls.

### SSE Streaming

Progress updates (`5% → 15% → 25% → ...`) are published to Redis pub/sub by the worker and streamed to the browser via `GET /repos/:id/status`. File explanations are streamed token-by-token directly from the LLM.

### Caching

File explanations are cached by `SHA-256(file content)` — so if the same file appears in multiple repos or the repo is re-analysed without changes, the explanation is served instantly from Redis or PostgreSQL.

### Dependency Graph

Import statements are extracted with regex across all non-`node_modules` files. Nodes are files and directories; edges are import relationships. The graph is stored in PostgreSQL and visualized with react-flow + dagre layout.
