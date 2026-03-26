CREATE TABLE IF NOT EXISTS "job_dedupe_ranks" (
  "job_id" text PRIMARY KEY NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "dedupe_rank" integer NOT NULL,
  "dedupe_group" text NOT NULL,
  "computed_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_job_dedupe_ranks_rank" ON "job_dedupe_ranks" ("dedupe_rank");
CREATE INDEX IF NOT EXISTS "idx_job_dedupe_ranks_group" ON "job_dedupe_ranks" ("dedupe_group");
