-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'FETCHING', 'ANALYZING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('FILE', 'MODULE', 'EXTERNAL_PACKAGE');

-- CreateEnum
CREATE TYPE "EdgeType" AS ENUM ('IMPORTS', 'DEPENDS_ON', 'EXTENDS', 'CALLS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "github_id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "avatar_url" TEXT,
    "github_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "github_url" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "default_branch" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "content_hash" TEXT,
    "analyzed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_jobs" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "bull_job_id" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "current_step" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "architectures" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "techStack" JSONB NOT NULL,
    "patterns" JSONB NOT NULL,
    "entry_points" JSONB NOT NULL,
    "llm_provider" TEXT NOT NULL,
    "llm_model" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "architectures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "responsibility" TEXT NOT NULL,
    "file_count" INTEGER NOT NULL,
    "language" TEXT,
    "exports" JSONB NOT NULL DEFAULT '[]',
    "imports" JSONB NOT NULL DEFAULT '[]',
    "llm_provider" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_explanations" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "key_functions" JSONB NOT NULL,
    "dependencies" JSONB NOT NULL DEFAULT '[]',
    "llm_provider" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_explanations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_nodes" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "NodeType" NOT NULL,
    "path" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "graph_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_edges" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "type" "EdgeType" NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "repositories_user_id_idx" ON "repositories"("user_id");

-- CreateIndex
CREATE INDEX "repositories_status_idx" ON "repositories"("status");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_user_id_full_name_key" ON "repositories"("user_id", "full_name");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_jobs_repository_id_key" ON "analysis_jobs"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "architectures_repository_id_key" ON "architectures"("repository_id");

-- CreateIndex
CREATE INDEX "modules_repository_id_idx" ON "modules"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "modules_repository_id_path_key" ON "modules"("repository_id", "path");

-- CreateIndex
CREATE INDEX "file_explanations_repository_id_idx" ON "file_explanations"("repository_id");

-- CreateIndex
CREATE INDEX "file_explanations_file_path_idx" ON "file_explanations"("file_path");

-- CreateIndex
CREATE UNIQUE INDEX "file_explanations_repository_id_content_hash_key" ON "file_explanations"("repository_id", "content_hash");

-- CreateIndex
CREATE INDEX "graph_nodes_repository_id_idx" ON "graph_nodes"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "graph_nodes_repository_id_node_id_key" ON "graph_nodes"("repository_id", "node_id");

-- CreateIndex
CREATE INDEX "graph_edges_repository_id_idx" ON "graph_edges"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "graph_edges_repository_id_source_id_target_id_type_key" ON "graph_edges"("repository_id", "source_id", "target_id", "type");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architectures" ADD CONSTRAINT "architectures_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_explanations" ADD CONSTRAINT "file_explanations_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_nodes" ADD CONSTRAINT "graph_nodes_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_repository_id_source_id_fkey" FOREIGN KEY ("repository_id", "source_id") REFERENCES "graph_nodes"("repository_id", "node_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_repository_id_target_id_fkey" FOREIGN KEY ("repository_id", "target_id") REFERENCES "graph_nodes"("repository_id", "node_id") ON DELETE RESTRICT ON UPDATE CASCADE;
