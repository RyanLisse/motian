CREATE TABLE "ai_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"flow" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd_micros" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "idx_ai_usage_flow" ON "ai_usage" USING btree ("flow");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_model" ON "ai_usage" USING btree ("model");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_created_at" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_flow_created_at" ON "ai_usage" USING btree ("flow","created_at");