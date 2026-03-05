CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb,
	"message_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chat_sessions_session_id" ON "chat_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_chat_sessions_updated_at" ON "chat_sessions" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_platform_settings_category_key" ON "platform_settings" USING btree ("category","key");--> statement-breakpoint
CREATE INDEX "idx_platform_settings_category" ON "platform_settings" USING btree ("category");