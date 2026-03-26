-- Enable pgvector (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Convert existing text data to vector type
-- The text column contains JSON arrays like "[0.1,0.2,...]"
ALTER TABLE "jobs" ALTER COLUMN "embedding" TYPE vector(512) USING embedding::vector(512);--> statement-breakpoint
ALTER TABLE "candidates" ALTER COLUMN "embedding" TYPE vector(512) USING embedding::vector(512);--> statement-breakpoint

-- Create HNSW indexes for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS "idx_jobs_embedding_hnsw" ON "jobs" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_candidates_embedding_hnsw" ON "candidates" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);
