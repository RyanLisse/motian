-- GIN index on categories JSONB for ? operator filtering
-- (tsvector GIN index idx_jobs_search_text_fts already exists from migration 0015)
-- Note: not using CONCURRENTLY as Drizzle wraps migrations in transactions
CREATE INDEX IF NOT EXISTS idx_jobs_categories_gin
ON jobs USING GIN (categories);
