import { and, db, desc, eq, sql } from "../db";
import { agentEvents } from "../db/schema";
import { publish as ssePublish } from "../lib/event-bus";

// ---------- Types ----------

/** All recognized agent names in the system. */
export type AgentName =
  | "intake"
  | "matcher"
  | "screener"
  | "scheduler"
  | "sourcing"
  | "communicator";

/** All event types agents can emit. */
export type AgentEventType =
  // Intake agent events
  | "candidate.parsed"
  | "candidate.enriched"
  | "candidate.embedded"
  // Matcher agent events
  | "match.created"
  | "match.updated"
  | "match.batch_completed"
  // Screener agent events
  | "screening.requested"
  | "screening.started"
  | "screening.completed"
  // Scheduler agent events
  | "interview.scheduled"
  | "interview.reminder_sent"
  // Sourcing agent events
  | "sourcing.search_completed"
  | "sourcing.candidate_found"
  // Communicator agent events
  | "notification.email_sent"
  | "notification.whatsapp_sent"
  | "notification.sms_sent";

export interface EmitEventInput {
  sourceAgent: AgentName;
  eventType: AgentEventType;
  candidateId?: string;
  jobId?: string;
  matchId?: string;
  screeningCallId?: string;
  payload?: Record<string, unknown>;
  triggerRunId?: string;
}

// ---------- Core operations ----------

/** Persist a new agent event and broadcast to SSE listeners. */
export async function emitAgentEvent(input: EmitEventInput) {
  const [event] = await db
    .insert(agentEvents)
    .values({
      sourceAgent: input.sourceAgent,
      eventType: input.eventType,
      candidateId: input.candidateId,
      jobId: input.jobId,
      matchId: input.matchId,
      screeningCallId: input.screeningCallId,
      payload: input.payload ?? {},
      triggerRunId: input.triggerRunId,
      status: "pending",
    })
    .returning();

  // Also push to in-memory SSE for real-time dashboard
  ssePublish(`agent:${input.eventType}`, {
    eventId: event.id,
    sourceAgent: input.sourceAgent,
    candidateId: input.candidateId ?? null,
    jobId: input.jobId ?? null,
    matchId: input.matchId ?? null,
    ...(input.payload ?? {}),
  });

  return event;
}

/** Claim a pending event for processing (atomic update). */
export async function claimEvent(eventId: string, processor: AgentName) {
  const [updated] = await db
    .update(agentEvents)
    .set({ status: "processing", processedBy: processor })
    .where(and(eq(agentEvents.id, eventId), eq(agentEvents.status, "pending")))
    .returning();

  return updated ?? null;
}

/** Mark an event as completed after successful processing. */
export async function completeEvent(eventId: string) {
  const [updated] = await db
    .update(agentEvents)
    .set({ status: "completed", processedAt: new Date() })
    .where(eq(agentEvents.id, eventId))
    .returning();

  return updated ?? null;
}

/** Mark an event as failed with error details. */
export async function failEvent(eventId: string, errorMessage: string) {
  const [updated] = await db
    .update(agentEvents)
    .set({
      status: "failed",
      processedAt: new Date(),
      errorMessage,
    })
    .where(eq(agentEvents.id, eventId))
    .returning();

  return updated ?? null;
}

/** Fetch recent agent events for the activity feed. */
export async function getRecentEvents(options: {
  limit?: number;
  sourceAgent?: AgentName;
  eventType?: AgentEventType;
}) {
  const { limit = 50, sourceAgent, eventType } = options;

  const conditions = [];
  if (sourceAgent) conditions.push(eq(agentEvents.sourceAgent, sourceAgent));
  if (eventType) conditions.push(eq(agentEvents.eventType, eventType));

  const query = db.select().from(agentEvents).orderBy(desc(agentEvents.createdAt)).limit(limit);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}

/** Count pending events by type — useful for monitoring. */
export async function getPendingEventCounts() {
  const pending = await db
    .select({
      eventType: agentEvents.eventType,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(agentEvents)
    .where(eq(agentEvents.status, "pending"))
    .groupBy(agentEvents.eventType);

  return pending;
}
