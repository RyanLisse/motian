CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"candidate_id" uuid,
	"match_id" uuid,
	"stage" text DEFAULT 'new' NOT NULL,
	"source" text DEFAULT 'manual',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"duration" integer DEFAULT 60,
	"type" text NOT NULL,
	"interviewer" text NOT NULL,
	"location" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"feedback" text,
	"rating" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"channel" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_match_id_job_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."job_matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_applications_job_id" ON "applications" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_applications_candidate_id" ON "applications" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "idx_applications_stage" ON "applications" USING btree ("stage");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_applications_job_candidate" ON "applications" USING btree ("job_id","candidate_id");--> statement-breakpoint
CREATE INDEX "idx_interviews_application_id" ON "interviews" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_interviews_scheduled_at" ON "interviews" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_interviews_status" ON "interviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_messages_application_id" ON "messages" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_messages_direction" ON "messages" USING btree ("direction");