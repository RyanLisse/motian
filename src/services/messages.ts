import { and, db, desc, eq, isNull, sql } from "../db";
import { messages } from "../db/schema";

export type Message = typeof messages.$inferSelect;

const VALID_DIRECTIONS = ["inbound", "outbound"];
const VALID_CHANNELS = ["email", "phone", "platform"];

export type ListMessagesOpts = {
  applicationId?: string;
  direction?: string;
  channel?: string;
  limit?: number;
  offset?: number;
};

function buildMessageWhere(opts: ListMessagesOpts) {
  const conditions = [isNull(messages.deletedAt)];
  if (opts.applicationId) conditions.push(eq(messages.applicationId, opts.applicationId));
  if (opts.direction) conditions.push(eq(messages.direction, opts.direction));
  if (opts.channel) conditions.push(eq(messages.channel, opts.channel));
  return and(...conditions);
}

export async function listMessages(opts: ListMessagesOpts = {}): Promise<Message[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = Math.max(0, opts.offset ?? 0);
  const where = buildMessageWhere(opts);
  return db
    .select()
    .from(messages)
    .where(where)
    .orderBy(desc(messages.sentAt))
    .limit(limit)
    .offset(offset);
}

export async function countMessages(
  opts: Omit<ListMessagesOpts, "limit" | "offset"> = {},
): Promise<number> {
  const where = buildMessageWhere(opts);
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(messages)
    .where(where);
  return count ?? 0;
}

export async function getMessageById(id: string): Promise<Message | null> {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, id), isNull(messages.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteMessage(id: string): Promise<boolean> {
  const result = await db
    .update(messages)
    .set({ deletedAt: new Date() })
    .where(and(eq(messages.id, id), isNull(messages.deletedAt)));
  return (result.rowsAffected ?? 0) > 0;
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
