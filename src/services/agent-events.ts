import { and, db, desc, eq, sql } from "../db";
import { agentEvents } from "../db/schema";
import { publish as ssePublish } from "../lib/event-bus";

// ---------- Event-driven dispatch ----------

/**
 * Immediately dispatches a newly created event to the appropriate downstream
 * Trigger.dev task. Uses string task IDs to avoid circular imports (tasks
 * import from services; services must not import task objects).
 *
 * Fire-and-forget: a failed dispatch does NOT prevent the event from being
 * persisted. The hourly cleanup job will catch any stragglers.
 */
async function dispatchEvent(event: typeof agentEvents.$inferSelect) {
  let triggerTasks: typeof import("@trigger.dev/sdk").tasks;
  try {
    const sdk = await import("@trigger.dev/sdk");
    triggerTasks = sdk.tasks;
  } catch {
    // Trigger SDK not available (e.g., edge runtime) — skip dispatch
    return;
  }

  const payload = (event.payload as Record<string, unknown>) ?? {};

  switch (event.eventType) {
    case "candidate.parsed": {
      if (!event.candidateId) break;
      const claimed = await claimEvent(event.id, "matcher" as AgentName);
      if (!claimed) break;
      await triggerTasks.trigger("agent-matcher", {
        mode: "candidate",
        candidateId: event.candidateId,
        topN: 5,
      });
      await completeEvent(event.id);
      break;
    }

    case "match.created": {
      if (!event.candidateId) break;
      const score = (payload.quickScore as number) ?? (payload.structuredScore as number) ?? 0;
      if (score < 50) {
        await completeEvent(event.id);
        break;
      }
      const claimedMatch = await claimEvent(event.id, "communicator" as AgentName);
      if (!claimedMatch) break;
      // Communicator task resolves candidate email + name from candidateId
      await triggerTasks.trigger("agent-communicator", {
        channel: "email",
        candidateId: event.candidateId,
        jobId: event.jobId ?? undefined,
        matchId: event.matchId ?? undefined,
        template: "match_notification",
        variables: {
          jobTitle: (payload.jobTitle as string) ?? "Nieuwe vacature",
          company: (payload.company as string) ?? "",
          matchScore: String(Math.round(score)),
        },
      });
      await completeEvent(event.id);
      break;
    }

    case "screening.requested": {
      if (!event.candidateId) break;
      const claimedScreening = await claimEvent(event.id, "communicator" as AgentName);
      if (!claimedScreening) break;
      await triggerTasks.trigger("agent-communicator", {
        channel: "email",
        candidateId: event.candidateId,
        jobId: event.jobId ?? undefined,
        matchId: event.matchId ?? undefined,
        screeningCallId: event.screeningCallId ?? undefined,
        template: "screening_invite",
        variables: {
          jobTitle: (payload.jobTitle as string) ?? "",
          matchScore: String(Math.round((payload.score as number) ?? 0)),
        },
      });
      await completeEvent(event.id);
      break;
    }

    case "screening.completed": {
      if (!event.candidateId) break;
      const nextStep = payload.recommendedNextStep as string;
      if (nextStep === "proceed") {
        const claimedCompleted = await claimEvent(event.id, "communicator" as AgentName);
        if (!claimedCompleted) break;
        await triggerTasks.trigger("agent-communicator", {
          channel: "email",
          candidateId: event.candidateId,
          jobId: event.jobId ?? undefined,
          matchId: event.matchId ?? undefined,
          template: "interview_confirmation",
          variables: {
            jobTitle: (payload.jobTitle as string) ?? "",
          },
        });
        await completeEvent(event.id);
      } else {
        await completeEvent(event.id);
      }
      break;
    }

    // Other event types don't need downstream dispatch
    default:
      break;
  }
}

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

  // Immediately dispatch to downstream agent (event-driven, zero delay).
  // Fire-and-forget: failures are logged, not thrown. The hourly cleanup
  // job catches any events that remain in "pending" status.
  try {
    await dispatchEvent(event);
  } catch (dispatchErr) {
    console.error(
      `[agent-events] Dispatch mislukt voor ${input.eventType}:`,
      dispatchErr instanceof Error ? dispatchErr.message : dispatchErr,
    );
  }

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
