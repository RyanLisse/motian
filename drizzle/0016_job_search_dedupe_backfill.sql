ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "dedupe_title_normalized" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "dedupe_client_normalized" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "dedupe_location_normalized" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "search_text" text NOT NULL DEFAULT '';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_dedupe_partition" ON "jobs" USING btree ("dedupe_title_normalized","dedupe_client_normalized","dedupe_location_normalized","scraped_at","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_search_text_fts" ON "jobs" USING gin (to_tsvector('dutch', "search_text"));--> statement-breakpoint
WITH computed_job_search_fields AS (
  SELECT
    "id",
    trim(regexp_replace(lower(coalesce("title", '')), '[^[:alnum:]]+', ' ', 'g')) AS "next_dedupe_title_normalized",
    trim(regexp_replace(lower(coalesce("end_client", "company", '')), '[^[:alnum:]]+', ' ', 'g')) AS "next_dedupe_client_normalized",
    trim(regexp_replace(lower(coalesce("province", "location", '')), '[^[:alnum:]]+', ' ', 'g')) AS "next_dedupe_location_normalized",
    concat_ws(
      ' ',
      nullif(regexp_replace(trim(coalesce("title", '')), '\s+', ' ', 'g'), ''),
      nullif(regexp_replace(trim(coalesce("company", '')), '\s+', ' ', 'g'), ''),
      nullif(regexp_replace(trim(coalesce("description", '')), '\s+', ' ', 'g'), ''),
      nullif(regexp_replace(trim(coalesce("location", '')), '\s+', ' ', 'g'), ''),
      nullif(regexp_replace(trim(coalesce("province", '')), '\s+', ' ', 'g'), '')
    ) AS "next_search_text"
  FROM "jobs"
)
UPDATE "jobs"
SET
  "dedupe_title_normalized" = computed_job_search_fields."next_dedupe_title_normalized",
  "dedupe_client_normalized" = computed_job_search_fields."next_dedupe_client_normalized",
  "dedupe_location_normalized" = computed_job_search_fields."next_dedupe_location_normalized",
  "search_text" = computed_job_search_fields."next_search_text"
FROM computed_job_search_fields
WHERE "jobs"."id" = computed_job_search_fields."id"
  AND (
    "jobs"."dedupe_title_normalized" IS DISTINCT FROM computed_job_search_fields."next_dedupe_title_normalized"
    OR "jobs"."dedupe_client_normalized" IS DISTINCT FROM computed_job_search_fields."next_dedupe_client_normalized"
    OR "jobs"."dedupe_location_normalized" IS DISTINCT FROM computed_job_search_fields."next_dedupe_location_normalized"
    OR "jobs"."search_text" IS DISTINCT FROM computed_job_search_fields."next_search_text"
  );