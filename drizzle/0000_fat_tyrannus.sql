CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"external_url" text,
	"client_reference_code" text,
	"title" text NOT NULL,
	"company" text,
	"contract_label" text,
	"location" text,
	"province" text,
	"description" text,
	"rate_min" integer,
	"rate_max" integer,
	"currency" text DEFAULT 'EUR',
	"positions_available" integer DEFAULT 1,
	"start_date" timestamp,
	"end_date" timestamp,
	"application_deadline" timestamp,
	"posted_at" timestamp,
	"contract_type" text,
	"work_arrangement" text,
	"allows_subcontracting" boolean,
	"requirements" jsonb DEFAULT '[]'::jsonb,
	"wishes" jsonb DEFAULT '[]'::jsonb,
	"competences" jsonb DEFAULT '[]'::jsonb,
	"conditions" jsonb DEFAULT '[]'::jsonb,
	"scraped_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	"raw_payload" jsonb,
	"embedding" text
);
--> statement-breakpoint
CREATE TABLE "scrape_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid,
	"platform" text NOT NULL,
	"run_at" timestamp DEFAULT now(),
	"duration_ms" integer,
	"jobs_found" integer DEFAULT 0,
	"jobs_new" integer DEFAULT 0,
	"duplicates" integer DEFAULT 0,
	"status" text NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "scraper_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"base_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb,
	"auth_config_encrypted" text,
	"cron_expression" text DEFAULT '0 0 */4 * * *',
	"last_run_at" timestamp,
	"last_run_status" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "scrape_results" ADD CONSTRAINT "scrape_results_config_id_scraper_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."scraper_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_platform_external_id" ON "jobs" USING btree ("platform","external_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_title_btree" ON "jobs" USING btree ("title");--> statement-breakpoint
CREATE INDEX "idx_jobs_platform" ON "jobs" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "idx_jobs_scraped_at" ON "jobs" USING btree ("scraped_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_deleted_at" ON "jobs" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_deadline" ON "jobs" USING btree ("application_deadline");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_platform_external_url" ON "jobs" USING btree ("platform","external_url");--> statement-breakpoint
CREATE INDEX "idx_scrape_results_config_id" ON "scrape_results" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "idx_scrape_results_run_at" ON "scrape_results" USING btree ("run_at");--> statement-breakpoint
CREATE INDEX "idx_scrape_results_platform" ON "scrape_results" USING btree ("platform");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_scraper_configs_platform" ON "scraper_configs" USING btree ("platform");