CREATE TABLE "gdpr_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"requested_by" text NOT NULL,
	"reason" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "resume_raw" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "resume_parsed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "skills_structured" jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "education" jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "certifications" jsonb;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "language_skills" jsonb;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "job_matches" ADD COLUMN "criteria_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "job_matches" ADD COLUMN "risk_profile" jsonb;--> statement-breakpoint
ALTER TABLE "job_matches" ADD COLUMN "enrichment_suggestions" jsonb;--> statement-breakpoint
ALTER TABLE "job_matches" ADD COLUMN "recommendation" text;--> statement-breakpoint
ALTER TABLE "job_matches" ADD COLUMN "recommendation_confidence" real;--> statement-breakpoint
ALTER TABLE "job_matches" ADD COLUMN "assessment_model" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX "idx_gdpr_audit_subject" ON "gdpr_audit_log" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "idx_gdpr_audit_action" ON "gdpr_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_gdpr_audit_created_at" ON "gdpr_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_interviews_deleted_at" ON "interviews" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_messages_deleted_at" ON "messages" USING btree ("deleted_at");