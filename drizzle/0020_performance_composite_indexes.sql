-- Composite index for ESCO skill filtering (EXISTS subquery)
CREATE INDEX IF NOT EXISTS "idx_job_skills_esco_job"
  ON "job_skills" ("esco_uri", "job_id");
--> statement-breakpoint

-- Partial index for "open jobs" (most common filter)
CREATE INDEX IF NOT EXISTS "idx_jobs_open_active"
  ON "jobs" ("status", "scraped_at" DESC)
  WHERE "deleted_at" IS NULL AND "status" = 'open';
--> statement-breakpoint

-- Pipeline count aggregation
CREATE INDEX IF NOT EXISTS "idx_applications_job_active"
  ON "applications" ("job_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- Platform + active filter
CREATE INDEX IF NOT EXISTS "idx_jobs_platform_active"
  ON "jobs" ("platform", "scraped_at" DESC)
  WHERE "deleted_at" IS NULL;
