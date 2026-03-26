CREATE TABLE "job_dedupe_ranks" (
	"job_id" text PRIMARY KEY NOT NULL,
	"dedupe_rank" integer NOT NULL,
	"dedupe_group" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sidebar_metadata" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"end_clients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skill_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skill_empty_text" text DEFAULT 'Geen vaardigheden gevonden.' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_jobs_title_btree";--> statement-breakpoint
DROP INDEX "uq_applications_job_candidate_active";--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "job_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "candidate_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "match_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "autopilot_findings" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "autopilot_findings" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "autopilot_findings" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "autopilot_findings" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "autopilot_runs" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "autopilot_runs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "autopilot_runs" ALTER COLUMN "started_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "autopilot_runs" ALTER COLUMN "completed_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "autopilot_runs" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "candidate_skills" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "candidate_skills" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "candidate_skills" ALTER COLUMN "candidate_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "candidate_skills" ALTER COLUMN "mapped_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "candidate_skills" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "candidates" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "candidates" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "candidates" ALTER COLUMN "embedding" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "candidates" ALTER COLUMN "resume_parsed_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "candidates" ALTER COLUMN "last_matched_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "candidates" ALTER COLUMN "matching_status_updated_at" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "candidates" ALTER COLUMN "matching_status_updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "candidates" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "candidates" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "chat_session_messages" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "chat_session_messages" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "chat_session_messages" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "chat_sessions" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "chat_sessions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "chat_sessions" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "chat_sessions" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "esco_skills" ALTER COLUMN "imported_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "esco_skills" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "gdpr_audit_log" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "gdpr_audit_log" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "gdpr_audit_log" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "application_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "job_matches" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "job_matches" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "job_matches" ALTER COLUMN "job_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "job_matches" ALTER COLUMN "candidate_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "job_matches" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "job_skills" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "job_skills" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "job_skills" ALTER COLUMN "job_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "job_skills" ALTER COLUMN "mapped_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "job_skills" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "scraped_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "embedding" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "application_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "sent_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "platform_catalog" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "platform_catalog" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "platform_onboarding_runs" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "platform_onboarding_runs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "platform_onboarding_runs" ALTER COLUMN "config_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "platform_onboarding_runs" ALTER COLUMN "started_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "platform_onboarding_runs" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "platform_onboarding_runs" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "platform_settings" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "platform_settings" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "platform_settings" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scrape_results" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "scrape_results" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scrape_results" ALTER COLUMN "config_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "scrape_results" ALTER COLUMN "run_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scraper_configs" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "scraper_configs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scraper_configs" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scraper_configs" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "skill_aliases" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "skill_aliases" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "skill_aliases" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "skill_mappings" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "skill_mappings" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "skill_mappings" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "job_dedupe_ranks" ADD CONSTRAINT "job_dedupe_ranks_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_jobs_title" ON "jobs" USING btree ("title");--> statement-breakpoint
CREATE INDEX "idx_jobs_province" ON "jobs" USING btree ("province");--> statement-breakpoint
CREATE INDEX "idx_jobs_contract_type" ON "jobs" USING btree ("contract_type");--> statement-breakpoint
CREATE INDEX "idx_jobs_work_arrangement" ON "jobs" USING btree ("work_arrangement");--> statement-breakpoint
CREATE INDEX "idx_jobs_posted_at" ON "jobs" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_start_date" ON "jobs" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_jobs_rate_range" ON "jobs" USING btree ("rate_min","rate_max");--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_jobs_hours" ON "jobs" USING btree ("min_hours_per_week","hours_per_week");--> statement-breakpoint
CREATE INDEX "idx_jobs_status_platform" ON "jobs" USING btree ("status","platform");--> statement-breakpoint
CREATE INDEX "idx_jobs_status_province" ON "jobs" USING btree ("status","province");--> statement-breakpoint
CREATE INDEX "idx_jobs_status_scraped_at" ON "jobs" USING btree ("status","scraped_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_status_deleted_at" ON "jobs" USING btree ("status","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_applications_job_candidate_active" ON "applications" USING btree ("job_id","candidate_id") WHERE deleted_at IS NULL;