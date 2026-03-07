ALTER TABLE "candidates"
ADD COLUMN IF NOT EXISTS "matching_status" text NOT NULL DEFAULT 'open';

ALTER TABLE "candidates"
ADD COLUMN IF NOT EXISTS "last_matched_at" timestamp with time zone;

ALTER TABLE "candidates"
ADD COLUMN IF NOT EXISTS "matching_status_updated_at" timestamp with time zone NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS "idx_candidates_matching_status"
  ON "candidates" USING btree ("matching_status");

CREATE INDEX IF NOT EXISTS "idx_candidates_last_matched_at"
  ON "candidates" USING btree ("last_matched_at");

UPDATE "candidates"
SET
  "matching_status" = 'linked',
  "matching_status_updated_at" = COALESCE("matching_status_updated_at", now())
WHERE EXISTS (
  SELECT 1
  FROM "applications"
  WHERE "applications"."candidate_id" = "candidates"."id"
    AND "applications"."deleted_at" IS NULL
);

DROP INDEX IF EXISTS "uq_applications_job_candidate";

CREATE UNIQUE INDEX IF NOT EXISTS "uq_applications_job_candidate_active"
  ON "applications" USING btree ("job_id", "candidate_id")
  WHERE "deleted_at" IS NULL;