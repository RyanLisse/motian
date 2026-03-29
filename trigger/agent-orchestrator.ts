import { logger, schedules } from "@trigger.dev/sdk";
import { and, db, eq, sql } from "@/src/db";
import { agentEvents } from "@/src/db/schema";
import { type AgentName, claimEvent, completeEvent, failEvent } from "@/src/services/agent-events";
import { getCandidateById } from "@/src/services/candidates";
import { agentCommunicatorTask } from "./agent-communicator";
import { agentMatcherTask } from "./agent-matcher";

/**
 * Agent Event Cleanup — fallback safety net for the event-driven dispatch system.
 *
 * Primary dispatch now happens inline in `emitAgentEvent()` (zero-delay,
 * event-driven). This cron runs hourly to catch any events that slipped
 * through — e.g. because the Trigger SDK was unavailable at emit time,
 * or a dispatch call failed and was swallowed by the try/catch.
 *
 * For each stale pending event it dispatches to the appropriate downstream agent:
 *   - candidate.parsed → Matcher agent
 *   - match.created → Communicator (email notification)
 *   - screening.requested → Communicator (screening invite)
 *   - screening.completed → Communicator (result notification)
 */

// Event → handler mapping
type EventHandler = (event: {
  id: string;
  eventType: string;
  candidateId: string | null;
  jobId: string | null;
  matchId: string | null;
  screeningCallId: string | null;
  payload: Record<string, unknown>;
}) => Promise<void>;

const EVENT_HANDLERS: Record<string, EventHandler> = {
  // When a candidate is parsed, trigger matching
  "candidate.parsed": async (event) => {
    if (!event.candidateId) return;

    await agentMatcherTask.trigger({
      mode: "candidate",
      candidateId: event.candidateId,
      topN: 5,
    });

    logger.info("Matcher agent getriggerd voor nieuwe kandidaat", {
      candidateId: event.candidateId,
    });
  },

  // When a match is created with high score, notify candidate
  "match.created": async (event) => {
    if (!event.candidateId) return;

    const payload = event.payload as Record<string, unknown>;
    const score = (payload.quickScore as number) ?? (payload.structuredScore as number) ?? 0;

    // Only send notifications for strong matches (≥50%)
    if (score < 50) return;

    const candidate = await getCandidateById(event.candidateId);
    if (!candidate?.email) return;

    await agentCommunicatorTask.trigger({
      channel: "email",
      candidateId: event.candidateId,
      jobId: event.jobId ?? undefined,
      matchId: event.matchId ?? undefined,
      template: "match_notification",
      recipient: candidate.email,
      variables: {
        candidateName: candidate.name,
        jobTitle: (payload.jobTitle as string) ?? "Nieuwe vacature",
        company: (payload.company as string) ?? "",
        matchScore: String(Math.round(score)),
      },
    });

    logger.info("Match notificatie verzonden", {
      candidateId: event.candidateId,
      matchId: event.matchId,
      score,
    });
  },

  // When screening is requested, send screening invite
  "screening.requested": async (event) => {
    if (!event.candidateId) return;

    const payload = event.payload as Record<string, unknown>;
    const candidate = await getCandidateById(event.candidateId);
    if (!candidate?.email) return;

    await agentCommunicatorTask.trigger({
      channel: "email",
      candidateId: event.candidateId,
      jobId: event.jobId ?? undefined,
      matchId: event.matchId ?? undefined,
      screeningCallId: event.screeningCallId ?? undefined,
      template: "screening_invite",
      recipient: candidate.email,
      variables: {
        candidateName: candidate.name,
        jobTitle: (payload.jobTitle as string) ?? "",
        matchScore: String(Math.round((payload.score as number) ?? 0)),
      },
    });

    logger.info("Screening uitnodiging verzonden", {
      candidateId: event.candidateId,
      screeningCallId: event.screeningCallId,
    });
  },

  // When screening is completed, results are available
  "screening.completed": async (event) => {
    if (!event.candidateId) return;

    const payload = event.payload as Record<string, unknown>;
    const candidate = await getCandidateById(event.candidateId);
    if (!candidate?.email) return;

    const nextStep = payload.recommendedNextStep as string;

    // Only send follow-up emails for "proceed" recommendations
    if (nextStep === "proceed") {
      await agentCommunicatorTask.trigger({
        channel: "email",
        candidateId: event.candidateId,
        jobId: event.jobId ?? undefined,
        matchId: event.matchId ?? undefined,
        template: "interview_confirmation",
        recipient: candidate.email,
        variables: {
          candidateName: candidate.name,
          jobTitle: (payload.jobTitle as string) ?? "",
        },
      });
    }

    logger.info("Screening afgerond verwerkt", {
      candidateId: event.candidateId,
      nextStep,
    });
  },
};

// Events the orchestrator processes
const PROCESSABLE_EVENTS = Object.keys(EVENT_HANDLERS);

export const agentOrchestratorTask = schedules.task({
  id: "agent-orchestrator",
  cron: {
    pattern: "0 * * * *", // Every hour (fallback cleanup — primary dispatch is event-driven)
    timezone: "Europe/Amsterdam",
  },
  maxDuration: 120, // 2 minutes max
  run: async () => {
    // Fetch pending events (batch of 20)
    const pending = await db
      .select()
      .from(agentEvents)
      .where(
        and(
          eq(agentEvents.status, "pending"),
          sql`${agentEvents.eventType} = ANY(${PROCESSABLE_EVENTS})`,
        ),
      )
      .orderBy(agentEvents.createdAt)
      .limit(20);

    if (pending.length === 0) {
      return { processed: 0, skipped: 0, errors: 0 };
    }

    logger.info(`Orchestrator: ${pending.length} events gevonden`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const event of pending) {
      // Claim the event atomically
      const claimed = await claimEvent(event.id, "orchestrator" as AgentName);
      if (!claimed) {
        skipped++;
        continue;
      }

      const handler = EVENT_HANDLERS[event.eventType];
      if (!handler) {
        await completeEvent(event.id);
        skipped++;
        continue;
      }

      try {
        await handler({
          id: event.id,
          eventType: event.eventType,
          candidateId: event.candidateId,
          jobId: event.jobId,
          matchId: event.matchId,
          screeningCallId: event.screeningCallId,
          payload: (event.payload as Record<string, unknown>) ?? {},
        });

        await completeEvent(event.id);
        processed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await failEvent(event.id, msg);
        errors++;
        logger.error(`Event ${event.id} verwerking mislukt`, {
          eventType: event.eventType,
          error: msg,
        });
      }
    }

    logger.info("Orchestrator cyclus voltooid", { processed, skipped, errors });

    return { processed, skipped, errors, total: pending.length };
  },
});
