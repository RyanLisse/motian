import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { interviews } from "../db/schema";

export type Interview = typeof interviews.$inferSelect;

const VALID_STATUSES = ["scheduled", "completed", "cancelled"];
const VALID_TYPES = ["phone", "video", "onsite", "technical"];

export type ListInterviewsOpts = {
  applicationId?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

function buildInterviewWhere(opts: ListInterviewsOpts) {
  const conditions = [isNull(interviews.deletedAt)];
  if (opts.applicationId) conditions.push(eq(interviews.applicationId, opts.applicationId));
  if (opts.status) conditions.push(eq(interviews.status, opts.status));
  return and(...conditions);
}

export async function listInterviews(opts: ListInterviewsOpts = {}): Promise<Interview[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = Math.max(0, opts.offset ?? 0);
  const where = buildInterviewWhere(opts);
  return db
    .select()
    .from(interviews)
    .where(where)
    .orderBy(desc(interviews.scheduledAt))
    .limit(limit)
    .offset(offset);
}

export async function countInterviews(
  opts: Omit<ListInterviewsOpts, "limit" | "offset"> = {},
): Promise<number> {
  const where = buildInterviewWhere(opts);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(interviews)
    .where(where);
  return count ?? 0;
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const rows = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.id, id), isNull(interviews.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createInterview(data: {
  applicationId: string;
  scheduledAt: Date;
  type: string;
  interviewer: string;
  duration?: number;
  location?: string;
}): Promise<Interview> {
  if (!VALID_TYPES.includes(data.type)) throw new Error(`Ongeldig interviewtype: ${data.type}`);
  const rows = await db
    .insert(interviews)
    .values({
      applicationId: data.applicationId,
      scheduledAt: data.scheduledAt,
      type: data.type,
      interviewer: data.interviewer,
      duration: data.duration ?? 60,
      location: data.location ?? null,
      status: "scheduled",
    })
    .returning();
  return rows[0];
}

export async function updateInterview(
  id: string,
  data: { status?: string; feedback?: string; rating?: number },
): Promise<{ interview: Interview | null; emptyUpdate: boolean }> {
  if (!data.status && !data.feedback && data.rating === undefined) {
    return { interview: null, emptyUpdate: true };
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.status) {
    if (!VALID_STATUSES.includes(data.status)) return { interview: null, emptyUpdate: false };
    updates.status = data.status;
  }
  if (data.feedback !== undefined) updates.feedback = data.feedback;
  if (data.rating !== undefined) {
    if (data.rating < 1 || data.rating > 5) return { interview: null, emptyUpdate: false };
    updates.rating = data.rating;
  }
  const rows = await db
    .update(interviews)
    .set(updates)
    .where(and(eq(interviews.id, id), isNull(interviews.deletedAt)))
    .returning();
  return { interview: rows[0] ?? null, emptyUpdate: false };
}

export async function deleteInterview(id: string): Promise<boolean> {
  const result = await db
    .update(interviews)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(interviews.id, id), isNull(interviews.deletedAt)));
  return (result.rowCount ?? 0) > 0;
}

export async function getUpcomingInterviews(): Promise<Interview[]> {
  return db
    .select()
    .from(interviews)
    .where(
      and(
        isNull(interviews.deletedAt),
        eq(interviews.status, "scheduled"),
        gte(interviews.scheduledAt, new Date()),
      ),
    )
    .orderBy(interviews.scheduledAt)
    .limit(20);
}
