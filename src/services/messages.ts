import { db } from "../db";
import { messages, applications, jobs, candidates } from "../db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

// ========== Constants ==========

export const VALID_DIRECTIONS = ["inbound", "outbound"] as const;
export const VALID_CHANNELS = ["email", "phone", "platform"] as const;

// ========== Types ==========

export type MessageRecord = typeof messages.$inferSelect;

export type Direction = (typeof VALID_DIRECTIONS)[number];
export type Channel = (typeof VALID_CHANNELS)[number];

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

  // Exclude messages belonging to soft-deleted applications
  conditions.push(isNull(applications.deletedAt));

  const where = and(...conditions);

  return db
    .select(messageWithDetailsSelect)
    .from(messages)
    .innerJoin(applications, eq(messages.applicationId, applications.id))
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
    .innerJoin(applications, eq(messages.applicationId, applications.id))
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .leftJoin(candidates, eq(applications.candidateId, candidates.id))
    .where(and(eq(messages.id, id), isNull(applications.deletedAt)))
    .limit(1);
  return result ?? null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createMessage(
  data: CreateMessageData,
): Promise<MessageRecord | null> {
  if (!VALID_DIRECTIONS.includes(data.direction as Direction)) return null;
  if (!VALID_CHANNELS.includes(data.channel as Channel)) return null;
  if (!UUID_RE.test(data.applicationId)) return null;

  // Verify applicationId exists and is not soft-deleted
  const [app] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.id, data.applicationId), isNull(applications.deletedAt)))
    .limit(1);
  if (!app) return null;

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
    .innerJoin(applications, eq(messages.applicationId, applications.id))
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .leftJoin(candidates, eq(applications.candidateId, candidates.id))
    .where(and(eq(messages.applicationId, applicationId), isNull(applications.deletedAt)))
    .orderBy(desc(messages.sentAt))
    .limit(Math.min(limit, 100));
}
