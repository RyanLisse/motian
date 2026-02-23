import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { messages } from "../db/schema";

export type Message = typeof messages.$inferSelect;

const VALID_DIRECTIONS = ["inbound", "outbound"];
const VALID_CHANNELS = ["email", "phone", "platform"];

export type ListMessagesOpts = {
  applicationId?: string;
  direction?: string;
  channel?: string;
  limit?: number;
};

export async function listMessages(opts: ListMessagesOpts): Promise<Message[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const conditions = [];
  if (opts.applicationId) conditions.push(eq(messages.applicationId, opts.applicationId));
  if (opts.direction) conditions.push(eq(messages.direction, opts.direction));
  if (opts.channel) conditions.push(eq(messages.channel, opts.channel));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(messages).where(where).orderBy(desc(messages.sentAt)).limit(limit);
}

export async function getMessageById(id: string): Promise<Message | null> {
  const rows = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteMessage(id: string): Promise<boolean> {
  const result = await db.delete(messages).where(eq(messages.id, id));
  return (result.rowCount ?? 0) > 0;
}

export async function createMessage(data: {
  applicationId: string;
  direction: string;
  channel: string;
  subject?: string;
  body: string;
}): Promise<Message | null> {
  if (!VALID_DIRECTIONS.includes(data.direction)) return null;
  if (!VALID_CHANNELS.includes(data.channel)) return null;
  const rows = await db
    .insert(messages)
    .values({
      applicationId: data.applicationId,
      direction: data.direction,
      channel: data.channel,
      subject: data.subject ?? null,
      body: data.body,
    })
    .returning();
  return rows[0] ?? null;
}
