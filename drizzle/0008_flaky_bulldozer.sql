CREATE TABLE "autopilot_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" text NOT NULL,
	"run_id" text NOT NULL,
	"category" text NOT NULL,
	"surface" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" text NOT NULL,
	"confidence" real NOT NULL,
	"auto_fixable" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'detected' NOT NULL,
	"fingerprint" text NOT NULL,
	"suspected_root_cause" text,
	"recommended_action" text,
	"github_issue_number" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "autopilot_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"commit_sha" text NOT NULL,
	"total_journeys" integer DEFAULT 0 NOT NULL,
	"passed_journeys" integer DEFAULT 0 NOT NULL,
	"failed_journeys" integer DEFAULT 0 NOT NULL,
	"total_findings" integer DEFAULT 0 NOT NULL,
	"findings_by_severity" jsonb DEFAULT '{}'::jsonb,
	"findings_by_category" jsonb DEFAULT '{}'::jsonb,
	"report_url" text,
	"trigger_run_id" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "autopilot_runs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "candidate_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"esco_uri" text NOT NULL,
	"source" text NOT NULL,
	"confidence" real,
	"confidence_hint" text,
	"evidence" text,
	"critical" boolean DEFAULT false NOT NULL,
	"mapping_strategy" text,
	"esco_version" text,
	"mapped_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_session_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"message_id" text NOT NULL,
	"role" text NOT NULL,
	"message" jsonb NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "esco_skills" (
	"uri" text PRIMARY KEY NOT NULL,
	"preferred_label_en" text NOT NULL,
	"preferred_label_nl" text,
	"skill_type" text,
	"reuse_level" text,
	"broader_uri" text,
	"esco_version" text NOT NULL,
	"raw_concept" jsonb DEFAULT '{}'::jsonb,
	"imported_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"esco_uri" text NOT NULL,
	"source" text NOT NULL,
	"confidence" real,
	"confidence_hint" text,
	"evidence" text,
	"required" boolean DEFAULT false NOT NULL,
	"critical" boolean DEFAULT false NOT NULL,
	"weight" real,
	"mapping_strategy" text,
	"esco_version" text,
	"mapped_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_catalog" (
	"slug" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"adapter_kind" text NOT NULL,
	"auth_mode" text NOT NULL,
	"attribution_label" text NOT NULL,
	"description" text DEFAULT '',
	"capabilities" jsonb DEFAULT '[]'::jsonb,
	"docs_url" text,
	"default_base_url" text,
	"config_schema" jsonb DEFAULT '{}'::jsonb,
	"auth_schema" jsonb DEFAULT '{}'::jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_self_serve" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_onboarding_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_slug" text NOT NULL,
	"config_id" uuid,
	"source" text DEFAULT 'ui' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_step" text DEFAULT 'create_draft' NOT NULL,
	"blocker_kind" text,
	"next_actions" jsonb DEFAULT '[]'::jsonb,
	"evidence" jsonb DEFAULT '{}'::jsonb,
	"result" jsonb DEFAULT '{}'::jsonb,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skill_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alias" text NOT NULL,
	"normalized_alias" text NOT NULL,
	"language" text,
	"source" text NOT NULL,
	"confidence" real,
	"esco_uri" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skill_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_skill" text NOT NULL,
	"normalized_skill" text NOT NULL,
	"esco_uri" text,
	"context_type" text NOT NULL,
	"context_id" text NOT NULL,
	"source" text NOT NULL,
	"strategy" text NOT NULL,
	"confidence" real,
	"evidence" text,
	"critical" boolean DEFAULT false NOT NULL,
	"sent_to_review" boolean DEFAULT false NOT NULL,
	"review_status" text,
	"esco_version" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP INDEX "uq_applications_job_candidate";--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "profile_summary" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "matching_status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "last_matched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "matching_status_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "tokens_used" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "end_client" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "dedupe_title_normalized" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "dedupe_client_normalized" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "dedupe_location_normalized" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "search_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "scrape_results" ADD COLUMN "job_ids" jsonb;--> statement-breakpoint
ALTER TABLE "scraper_configs" ADD COLUMN "credentials_ref" text;--> statement-breakpoint
ALTER TABLE "scraper_configs" ADD COLUMN "validation_status" text DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "scraper_configs" ADD COLUMN "last_validated_at" timestamp;--> statement-breakpoint
ALTER TABLE "scraper_configs" ADD COLUMN "last_validation_error" text;--> statement-breakpoint
ALTER TABLE "scraper_configs" ADD COLUMN "last_test_import_at" timestamp;--> statement-breakpoint
ALTER TABLE "scraper_configs" ADD COLUMN "last_test_import_status" text;--> statement-breakpoint
ALTER TABLE "autopilot_findings" ADD CONSTRAINT "autopilot_findings_run_id_autopilot_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."autopilot_runs"("run_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_esco_uri_esco_skills_uri_fk" FOREIGN KEY ("esco_uri") REFERENCES "public"."esco_skills"("uri") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_esco_uri_esco_skills_uri_fk" FOREIGN KEY ("esco_uri") REFERENCES "public"."esco_skills"("uri") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_onboarding_runs" ADD CONSTRAINT "platform_onboarding_runs_platform_slug_platform_catalog_slug_fk" FOREIGN KEY ("platform_slug") REFERENCES "public"."platform_catalog"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_onboarding_runs" ADD CONSTRAINT "platform_onboarding_runs_config_id_scraper_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."scraper_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_aliases" ADD CONSTRAINT "skill_aliases_esco_uri_esco_skills_uri_fk" FOREIGN KEY ("esco_uri") REFERENCES "public"."esco_skills"("uri") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_mappings" ADD CONSTRAINT "skill_mappings_esco_uri_esco_skills_uri_fk" FOREIGN KEY ("esco_uri") REFERENCES "public"."esco_skills"("uri") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_autopilot_findings_finding_id" ON "autopilot_findings" USING btree ("finding_id");--> statement-breakpoint
CREATE INDEX "idx_autopilot_findings_run_id" ON "autopilot_findings" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_autopilot_findings_fingerprint" ON "autopilot_findings" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "idx_autopilot_findings_severity" ON "autopilot_findings" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_autopilot_findings_status" ON "autopilot_findings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_autopilot_runs_run_id" ON "autopilot_runs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_autopilot_runs_status" ON "autopilot_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_autopilot_runs_started_at" ON "autopilot_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_candidate_skills_candidate_id" ON "candidate_skills" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "idx_candidate_skills_esco_uri" ON "candidate_skills" USING btree ("esco_uri");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_candidate_skills_candidate_esco_source" ON "candidate_skills" USING btree ("candidate_id","esco_uri","source");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chat_session_messages_session_message_id" ON "chat_session_messages" USING btree ("session_id","message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chat_session_messages_session_order_index" ON "chat_session_messages" USING btree ("session_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_chat_session_messages_session_order" ON "chat_session_messages" USING btree ("session_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_esco_skills_preferred_label_en" ON "esco_skills" USING btree ("preferred_label_en");--> statement-breakpoint
CREATE INDEX "idx_esco_skills_preferred_label_nl" ON "esco_skills" USING btree ("preferred_label_nl");--> statement-breakpoint
CREATE INDEX "idx_esco_skills_broader_uri" ON "esco_skills" USING btree ("broader_uri");--> statement-breakpoint
CREATE INDEX "idx_job_skills_job_id" ON "job_skills" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_skills_esco_uri" ON "job_skills" USING btree ("esco_uri");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_job_skills_job_esco_source" ON "job_skills" USING btree ("job_id","esco_uri","source");--> statement-breakpoint
CREATE INDEX "idx_job_skills_critical" ON "job_skills" USING btree ("critical");--> statement-breakpoint
CREATE INDEX "idx_platform_onboarding_runs_platform_slug" ON "platform_onboarding_runs" USING btree ("platform_slug");--> statement-breakpoint
CREATE INDEX "idx_platform_onboarding_runs_config_id" ON "platform_onboarding_runs" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "idx_platform_onboarding_runs_updated_at" ON "platform_onboarding_runs" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_platform_onboarding_runs_platform_slug_updated_at" ON "platform_onboarding_runs" USING btree ("platform_slug","updated_at");--> statement-breakpoint
CREATE INDEX "idx_skill_aliases_normalized_alias" ON "skill_aliases" USING btree ("normalized_alias");--> statement-breakpoint
CREATE INDEX "idx_skill_aliases_esco_uri" ON "skill_aliases" USING btree ("esco_uri");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_skill_aliases_alias_language_esco" ON "skill_aliases" USING btree ("normalized_alias","language","esco_uri");--> statement-breakpoint
CREATE INDEX "idx_skill_mappings_normalized_skill" ON "skill_mappings" USING btree ("normalized_skill");--> statement-breakpoint
CREATE INDEX "idx_skill_mappings_context" ON "skill_mappings" USING btree ("context_type","context_id");--> statement-breakpoint
CREATE INDEX "idx_skill_mappings_esco_uri" ON "skill_mappings" USING btree ("esco_uri");--> statement-breakpoint
CREATE INDEX "idx_skill_mappings_review_queue" ON "skill_mappings" USING btree ("sent_to_review","review_status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_applications_job_candidate_active" ON "applications" USING btree ("job_id","candidate_id") WHERE "applications"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_candidates_matching_status" ON "candidates" USING btree ("matching_status");--> statement-breakpoint
CREATE INDEX "idx_candidates_last_matched_at" ON "candidates" USING btree ("last_matched_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_archived_at" ON "jobs" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_dedupe_partition" ON "jobs" USING btree ("dedupe_title_normalized","dedupe_client_normalized","dedupe_location_normalized","scraped_at","id");