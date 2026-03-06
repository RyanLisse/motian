ALTER TABLE "jobs" ADD COLUMN "end_client" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
UPDATE "jobs"
SET
	"end_client" = COALESCE("end_client", "company"),
	"status" = CASE
		WHEN "deleted_at" IS NOT NULL THEN 'closed'
		WHEN "application_deadline" IS NOT NULL AND "application_deadline" < now() THEN 'closed'
		ELSE 'open'
	END;--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_jobs_end_client" ON "jobs" USING btree ("end_client");--> statement-breakpoint
CREATE INDEX "idx_jobs_status_end_client" ON "jobs" USING btree ("status","end_client");