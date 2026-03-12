CREATE TABLE IF NOT EXISTS "platform_catalog" (
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
);--> statement-breakpoint

ALTER TABLE "scraper_configs" ADD COLUMN IF NOT EXISTS "credentials_ref" text;--> statement-breakpoint
ALTER TABLE "scraper_configs" ADD COLUMN IF NOT EXISTS "validation_status" text DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "scraper_configs" ADD COLUMN IF NOT EXISTS "last_validated_at" timestamp;--> statement-breakpoint
ALTER TABLE "scraper_configs" ADD COLUMN IF NOT EXISTS "last_validation_error" text;--> statement-breakpoint
ALTER TABLE "scraper_configs" ADD COLUMN IF NOT EXISTS "last_test_import_at" timestamp;--> statement-breakpoint
ALTER TABLE "scraper_configs" ADD COLUMN IF NOT EXISTS "last_test_import_status" text;--> statement-breakpoint

INSERT INTO "platform_catalog" (
  "slug",
  "display_name",
  "adapter_kind",
  "auth_mode",
  "attribution_label",
  "description",
  "capabilities",
  "config_schema",
  "auth_schema",
  "is_enabled",
  "is_self_serve",
  "updated_at"
)
SELECT
  "platform",
  initcap(replace("platform", '_', ' ')),
  'http_html_list_detail',
  'none',
  initcap(replace("platform", '_', ' ')),
  '',
  '[]'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  true,
  false,
  now()
FROM "scraper_configs"
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "platform_onboarding_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "platform_slug" text NOT NULL REFERENCES "platform_catalog"("slug") ON DELETE cascade,
  "config_id" uuid REFERENCES "scraper_configs"("id") ON DELETE set null,
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
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_platform_onboarding_runs_platform_slug" ON "platform_onboarding_runs" USING btree ("platform_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_platform_onboarding_runs_config_id" ON "platform_onboarding_runs" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_platform_onboarding_runs_updated_at" ON "platform_onboarding_runs" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_platform_onboarding_runs_platform_slug_updated_at" ON "platform_onboarding_runs" USING btree ("platform_slug","updated_at");--> statement-breakpoint
