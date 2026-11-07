-- A Repository is now a global artifact keyed by full_name, not a per-user row.
-- A user's saved list (and, for private repos, their access grant) moves to
-- user_repositories.

-- DropForeignKey
ALTER TABLE "repositories" DROP CONSTRAINT "repositories_user_id_fkey";

-- DropIndex
DROP INDEX "repositories_user_id_full_name_key";

-- DropIndex
DROP INDEX "repositories_user_id_idx";

-- AlterTable
ALTER TABLE "repositories" DROP COLUMN "user_id";

-- CreateTable
CREATE TABLE "user_repositories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_repositories_user_id_idx" ON "user_repositories"("user_id");

-- CreateIndex
CREATE INDEX "user_repositories_repository_id_idx" ON "user_repositories"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_repositories_user_id_repository_id_key" ON "user_repositories"("user_id", "repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_full_name_key" ON "repositories"("full_name");

-- CreateIndex
CREATE INDEX "repositories_owner_name_idx" ON "repositories"("owner", "name");

-- AddForeignKey
ALTER TABLE "user_repositories" ADD CONSTRAINT "user_repositories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_repositories" ADD CONSTRAINT "user_repositories_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
