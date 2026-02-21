import { db } from "../db";
import { messages, applications, jobs, candidates } from "../db/schema";
import { and, desc, eq } from "drizzle-orm";

// ========== Constants ==========

export const VALID_DIRECTIONS = ["inbound", "outbound"] as const;
export const VALID_CHANNELS = ["email", "phone", "platform"] as const;

// ========== Types ==========

export type MessageRecord = typeof messages.$inferSelect;

export type CreateMessageData = {
  applicationId: string;
  direction: string;
  channel: string;
  subject?: string;
  body: string;
};

export type MessageWithDetails = MessageRecord & {
  candidateName: string | null;
  jobTitle: string | null;
};

// ========== Shared Select Shape ==========

const messageWithDetailsSelect = {
  id: messages.id,
  applicationId: messages.applicationId,
  direction: messages.direction,
  channel: messages.channel,
  subject: messages.subject,
  body: messages.body,
  sentAt: messages.sentAt,
  createdAt: messages.createdAt,
  candidateName: candidates.name,
  jobTitle: jobs.title,
};

// ========== Service Functions ==========

export async function listMessages(
  opts: {
    applicationId?: string;
    direction?: string;
    channel?: string;
    limit?: number;
  } = {},
): Promise<MessageWithDetails[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const conditions = [];

  if (opts.applicationId)
    conditions.push(eq(messages.applicationId, opts.applicationId));
  if (opts.direction) conditions.push(eq(messages.direction, opts.direction));
  if (opts.channel) conditions.push(eq(messages.channel, opts.channel));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select(messageWithDetailsSelect)
    .from(messages)
    .leftJoin(applications, eq(messages.applicationId, applications.id))
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .leftJoin(candidates, eq(applications.candidateId, candidates.id))
    .where(where)
    .orderBy(desc(messages.sentAt))
    .limit(limit);
}

export async function getMessageById(
  id: string,
): Promise<MessageWithDetails | null> {
  const [result] = await db
    .select(messageWithDetailsSelect)
    .from(messages)
    .leftJoin(applications, eq(messages.applicationId, applications.id))
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .leftJoin(candidates, eq(applications.candidateId, candidates.id))
    .where(eq(messages.id, id))
    .limit(1);
  return result ?? null;
}

export async function createMessage(
  data: CreateMessageData,
): Promise<MessageRecord> {
  const [result] = await db
    .insert(messages)
    .values({
      applicationId: data.applicationId,
      direction: data.direction,
      channel: data.channel,
      subject: data.subject,
      body: data.body,
    })
    .returning();
  return result;
}

export async function getMessagesByApplication(
  applicationId: string,
  limit = 50,
): Promise<MessageWithDetails[]> {
  return db
    .select(messageWithDetailsSelect)
    .from(messages)
    .leftJoin(applications, eq(messages.applicationId, applications.id))
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .leftJoin(candidates, eq(applications.candidateId, candidates.id))
    .where(eq(messages.applicationId, applicationId))
    .orderBy(desc(messages.sentAt))
    .limit(Math.min(limit, 100));
}
