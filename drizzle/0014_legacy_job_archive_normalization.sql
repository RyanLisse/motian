CREATE TABLE IF NOT EXISTS "job_archive_normalization_backups" (
	"job_id" uuid PRIMARY KEY REFERENCES "jobs"("id") ON DELETE CASCADE,
	"previous_status" text NOT NULL,
	"previous_deleted_at" timestamp,
	"previous_archived_at" timestamp,
	"captured_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_archived_at" ON "jobs" USING btree ("archived_at");--> statement-breakpoint
INSERT INTO "job_archive_normalization_backups" (
	"job_id",
	"previous_status",
	"previous_deleted_at",
	"previous_archived_at"
)
SELECT
	"id",
	"status",
	"deleted_at",
	"archived_at"
FROM "jobs"
WHERE "deleted_at" IS NOT NULL
ON CONFLICT ("job_id") DO NOTHING;--> statement-breakpoint
UPDATE "jobs"
SET
	"status" = 'archived',
	"archived_at" = COALESCE("archived_at", "deleted_at"),
	"deleted_at" = NULL
WHERE "deleted_at" IS NOT NULL
	AND (
		"status" <> 'archived'
		OR "archived_at" IS NULL
		OR "deleted_at" IS NOT NULL
	);--> statement-breakpoint