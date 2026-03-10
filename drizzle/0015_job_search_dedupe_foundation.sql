ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "dedupe_title_normalized" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "dedupe_client_normalized" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "dedupe_location_normalized" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "search_text" text NOT NULL DEFAULT '';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_dedupe_partition" ON "jobs" USING btree ("dedupe_title_normalized","dedupe_client_normalized","dedupe_location_normalized","scraped_at","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_search_text_fts" ON "jobs" USING gin (to_tsvector('dutch', "search_text"));--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_embedding_hnsw" ON "jobs"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);