import { db } from "../db";
import { interviews, applications, jobs, candidates } from "../db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

// ========== Types ==========

export type InterviewRecord = typeof interviews.$inferSelect;

export type CreateInterviewData = {
  applicationId: string;
  scheduledAt: Date;
  duration?: number;
  type: string;
  interviewer: string;
  location?: string;
};

export type UpdateInterviewData = {
  status?: string;
  feedback?: string;
  rating?: number;
};

export type InterviewWithDetails = InterviewRecord & {
  candidateName: string | null;
  jobTitle: string | null;
};

// ========== Shared Select Shape ==========

const interviewWithDetailsSelect = {
  id: interviews.id,
  applicationId: interviews.applicationId,
  scheduledAt: interviews.scheduledAt,
  duration: interviews.duration,
  type: interviews.type,
  interviewer: interviews.interviewer,
  location: interviews.location,
  status: interviews.status,
  feedback: interviews.feedback,
  rating: interviews.rating,
  createdAt: interviews.createdAt,
  candidateName: candidates.name,
  jobTitle: jobs.title,
};

// ========== Service Functions ==========

export async function listInterviews(
  opts: {
    applicationId?: string;
    status?: string;
    limit?: number;
  } = {},
): Promise<InterviewWithDetails[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const conditions = [];

  if (opts.applicationId)
    conditions.push(eq(interviews.applicationId, opts.applicationId));
  if (opts.status) conditions.push(eq(interviews.status, opts.status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select(interviewWithDetailsSelect)
    .from(interviews)
    .leftJoin(applications, eq(interviews.applicationId, applications.id))
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .leftJoin(candidates, eq(applications.candidateId, candidates.id))
    .where(where)
    .orderBy(desc(interviews.scheduledAt))
    .limit(limit);
}

export async function getInterviewById(
  id: string,
): Promise<InterviewWithDetails | null> {
  const [result] = await db
    .select(interviewWithDetailsSelect)
    .from(interviews)
    .leftJoin(applications, eq(interviews.applicationId, applications.id))
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .leftJoin(candidates, eq(applications.candidateId, candidates.id))
    .where(eq(interviews.id, id))
    .limit(1);
  return result ?? null;
}

export async function createInterview(
  data: CreateInterviewData,
): Promise<InterviewRecord> {
  const [result] = await db
    .insert(interviews)
    .values({
      applicationId: data.applicationId,
      scheduledAt: data.scheduledAt,
      duration: data.duration ?? 60,
      type: data.type,
      interviewer: data.interviewer,
      location: data.location,
    })
    .returning();
  return result;
}

export async function updateInterview(
  id: string,
  data: UpdateInterviewData,
): Promise<InterviewRecord | null> {
  const updates: Record<string, unknown> = {};
  if (data.status !== undefined) updates.status = data.status;
  if (data.feedback !== undefined) updates.feedback = data.feedback;
  if (data.rating !== undefined) updates.rating = data.rating;

  if (Object.keys(updates).length === 0) return null;

  const [result] = await db
    .update(interviews)
    .set(updates)
    .where(eq(interviews.id, id))
    .returning();
  return result ?? null;
}

export async function getUpcomingInterviews(
  limit = 10,
): Promise<InterviewWithDetails[]> {
  return db
    .select(interviewWithDetailsSelect)
    .from(interviews)
    .leftJoin(applications, eq(interviews.applicationId, applications.id))
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .leftJoin(candidates, eq(applications.candidateId, candidates.id))
    .where(
      and(
        eq(interviews.status, "scheduled"),
        sql`${interviews.scheduledAt} >= now()`,
      ),
    )
    .orderBy(interviews.scheduledAt)
    .limit(Math.min(limit, 50));
}
