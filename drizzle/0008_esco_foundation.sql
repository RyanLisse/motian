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
ALTER TABLE "skill_aliases" ADD CONSTRAINT "skill_aliases_esco_uri_esco_skills_uri_fk" FOREIGN KEY ("esco_uri") REFERENCES "public"."esco_skills"("uri") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_esco_uri_esco_skills_uri_fk" FOREIGN KEY ("esco_uri") REFERENCES "public"."esco_skills"("uri") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_esco_uri_esco_skills_uri_fk" FOREIGN KEY ("esco_uri") REFERENCES "public"."esco_skills"("uri") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "skill_mappings" ADD CONSTRAINT "skill_mappings_esco_uri_esco_skills_uri_fk" FOREIGN KEY ("esco_uri") REFERENCES "public"."esco_skills"("uri") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_esco_skills_preferred_label_en" ON "esco_skills" USING btree ("preferred_label_en");
--> statement-breakpoint
CREATE INDEX "idx_esco_skills_preferred_label_nl" ON "esco_skills" USING btree ("preferred_label_nl");
--> statement-breakpoint
CREATE INDEX "idx_esco_skills_broader_uri" ON "esco_skills" USING btree ("broader_uri");
--> statement-breakpoint
CREATE INDEX "idx_skill_aliases_normalized_alias" ON "skill_aliases" USING btree ("normalized_alias");
--> statement-breakpoint
CREATE INDEX "idx_skill_aliases_esco_uri" ON "skill_aliases" USING btree ("esco_uri");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_skill_aliases_alias_language_esco" ON "skill_aliases" USING btree ("normalized_alias","language","esco_uri");
--> statement-breakpoint
CREATE INDEX "idx_candidate_skills_candidate_id" ON "candidate_skills" USING btree ("candidate_id");
--> statement-breakpoint
CREATE INDEX "idx_candidate_skills_esco_uri" ON "candidate_skills" USING btree ("esco_uri");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_candidate_skills_candidate_esco_source" ON "candidate_skills" USING btree ("candidate_id","esco_uri","source");
--> statement-breakpoint
CREATE INDEX "idx_job_skills_job_id" ON "job_skills" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX "idx_job_skills_esco_uri" ON "job_skills" USING btree ("esco_uri");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_job_skills_job_esco_source" ON "job_skills" USING btree ("job_id","esco_uri","source");
--> statement-breakpoint
CREATE INDEX "idx_job_skills_critical" ON "job_skills" USING btree ("critical");
--> statement-breakpoint
CREATE INDEX "idx_skill_mappings_normalized_skill" ON "skill_mappings" USING btree ("normalized_skill");
--> statement-breakpoint
CREATE INDEX "idx_skill_mappings_context" ON "skill_mappings" USING btree ("context_type","context_id");
--> statement-breakpoint
CREATE INDEX "idx_skill_mappings_esco_uri" ON "skill_mappings" USING btree ("esco_uri");
--> statement-breakpoint
CREATE INDEX "idx_skill_mappings_review_queue" ON "skill_mappings" USING btree ("sent_to_review","review_status");
