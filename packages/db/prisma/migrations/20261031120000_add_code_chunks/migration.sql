-- Semantic search over repository code.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "code_chunks" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "start_line" INTEGER NOT NULL,
    "end_line" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "embedding" vector(768),
    "embedding_model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "code_chunks_repository_id_idx" ON "code_chunks"("repository_id");

-- CreateIndex
CREATE INDEX "code_chunks_file_path_idx" ON "code_chunks"("file_path");

-- CreateIndex
CREATE UNIQUE INDEX "code_chunks_repository_id_content_hash_key" ON "code_chunks"("repository_id", "content_hash");

-- AddForeignKey
ALTER TABLE "code_chunks" ADD CONSTRAINT "code_chunks_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NOTE: no HNSW/IVFFlat index here on purpose. A repo indexes a few hundred
-- chunks, which Postgres scans exactly in a couple of milliseconds, and an
-- index type Prisma cannot model would show up as schema drift on the next
-- `prisma migrate dev`. Add one once a single repo passes ~10k chunks.
