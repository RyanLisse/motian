-- Add performance indexes used by vacature search/list filters.
CREATE INDEX IF NOT EXISTS "idx_jobs_province" ON "jobs" ("province");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_contract_type" ON "jobs" ("contract_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_work_arrangement" ON "jobs" ("work_arrangement");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_posted_at" ON "jobs" ("posted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_start_date" ON "jobs" ("start_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_rate_range" ON "jobs" ("rate_min", "rate_max");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_hours" ON "jobs" ("min_hours_per_week", "hours_per_week");
--> statement-breakpoint
-- JSONB categories operator checks (`?`) benefit from GIN indexing.
CREATE INDEX IF NOT EXISTS "idx_jobs_categories" ON "jobs" USING GIN ("categories");
