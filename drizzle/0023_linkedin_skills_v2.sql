CREATE TABLE IF NOT EXISTS "skills" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_skills_slug" ON "skills" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_skills_name" ON "skills" USING btree ("name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidate_skills_v2" (
  "id" text PRIMARY KEY NOT NULL,
  "candidate_id" text NOT NULL,
  "skill_id" text NOT NULL,
  "raw_label" text,
  "source" text NOT NULL,
  "confidence" real,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "candidate_skills_v2" ADD CONSTRAINT IF NOT EXISTS "candidate_skills_v2_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "candidate_skills_v2" ADD CONSTRAINT IF NOT EXISTS "candidate_skills_v2_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_candidate_skills_v2_candidate_id" ON "candidate_skills_v2" USING btree ("candidate_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_candidate_skills_v2_skill_id" ON "candidate_skills_v2" USING btree ("skill_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_candidate_skills_v2_candidate_skill_source" ON "candidate_skills_v2" USING btree ("candidate_id","skill_id","source");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_skills_v2" (
  "id" text PRIMARY KEY NOT NULL,
  "job_id" text NOT NULL,
  "skill_id" text NOT NULL,
  "raw_label" text,
  "source" text NOT NULL,
  "importance" text DEFAULT 'nice' NOT NULL,
  "confidence" real,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "job_skills_v2" ADD CONSTRAINT IF NOT EXISTS "job_skills_v2_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "job_skills_v2" ADD CONSTRAINT IF NOT EXISTS "job_skills_v2_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_skills_v2_job_id" ON "job_skills_v2" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_skills_v2_skill_id" ON "job_skills_v2" USING btree ("skill_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_skills_v2_importance" ON "job_skills_v2" USING btree ("importance");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_job_skills_v2_job_skill_source" ON "job_skills_v2" USING btree ("job_id","skill_id","source");
