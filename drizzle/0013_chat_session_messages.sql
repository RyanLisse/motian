CREATE TABLE "chat_session_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"message_id" text NOT NULL,
	"role" text NOT NULL,
	"message" jsonb NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chat_session_messages_session_message_id" ON "chat_session_messages" USING btree ("session_id","message_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chat_session_messages_session_order_index" ON "chat_session_messages" USING btree ("session_id","order_index");
--> statement-breakpoint
CREATE INDEX "idx_chat_session_messages_session_order" ON "chat_session_messages" USING btree ("session_id","order_index");