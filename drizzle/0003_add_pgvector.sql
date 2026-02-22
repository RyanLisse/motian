-- Enable pgvector extension (Neon supports this natively)
CREATE EXTENSION IF NOT EXISTS vector;

-- Convert jobs.embedding from text to vector(512)
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "jobs" ADD COLUMN "embedding" vector(512);

-- Convert candidates.embedding from text to vector(512)
ALTER TABLE "candidates" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "candidates" ADD COLUMN "embedding" vector(512);

-- HNSW index for cosine similarity on jobs
CREATE INDEX "idx_jobs_embedding_hnsw" ON "jobs"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- HNSW index on candidates (for future use)
CREATE INDEX "idx_candidates_embedding_hnsw" ON "candidates"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
