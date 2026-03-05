CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"role" text,
	"location" text,
	"province" text,
	"skills" jsonb DEFAULT '[]'::jsonb,
	"experience" jsonb DEFAULT '[]'::jsonb,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"resume_url" text,
	"source" text,
	"notes" text,
	"hourly_rate" integer,
	"availability" text,
	"embedding" text,
	"consent_granted" boolean DEFAULT false,
	"data_retention_until" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "job_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"candidate_id" uuid,
	"match_score" real NOT NULL,
	"confidence" real,
	"reasoning" text,
	"model" text,
	"prompt_version" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "scraper_configs" ADD COLUMN "consecutive_failures" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_candidates_email" ON "candidates" USING btree ("email") WHERE email IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_candidates_name" ON "candidates" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_candidates_province" ON "candidates" USING btree ("province");--> statement-breakpoint
CREATE INDEX "idx_candidates_deleted_at" ON "candidates" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_job_matches_job_id" ON "job_matches" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_matches_candidate_id" ON "job_matches" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "idx_job_matches_status" ON "job_matches" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_job_matches_job_candidate" ON "job_matches" USING btree ("job_id","candidate_id");