CREATE TABLE IF NOT EXISTS "overlap_groups" (
  "id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
  "total_groups" integer DEFAULT 0 NOT NULL,
  "groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_overlap_groups_computed_at"
  ON "overlap_groups" ("computed_at");
