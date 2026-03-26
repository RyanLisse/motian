CREATE TABLE IF NOT EXISTS "sidebar_metadata" (
  "id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
  "total_count" integer NOT NULL DEFAULT 0,
  "platforms" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "end_clients" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "categories" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "skill_options" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "skill_empty_text" text NOT NULL DEFAULT 'Geen vaardigheden gevonden.',
  "computed_at" timestamp with time zone NOT NULL DEFAULT now()
);
