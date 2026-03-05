DROP INDEX IF EXISTS "uq_platform_external_url";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_platform_external_url" ON "jobs" USING btree ("platform","external_url");
