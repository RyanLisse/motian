import { logger, metadata, task } from "@trigger.dev/sdk";
import { db, eq } from "@/src/db";
import { candidates, jobs } from "@/src/db/schema";
import { emitAgentEvent } from "@/src/services/agent-events";

/**
 * Scheduler Agent — manages interview booking and reminders.
 *
 * Responsibilities:
 *   1. Auto-schedule interviews after successful screening calls
 *   2. Send reminders before interviews (24h, 1h)
 *   3. Track interview slots and availability
 *
 * Currently implements the core scheduling logic.
 * Future: integrate with Google Calendar / Cal.com for real slot booking.
 */

interface ScheduleInterviewPayload {
  candidateId: string;
  jobId: string;
  matchId?: string;
  screeningCallId?: string;
  /** Preferred time slots (ISO strings) */
  preferredSlots?: string[];
  /** Interview type */
  interviewType?: "video" | "phone" | "in_person";
  /** Duration in minutes */
  durationMinutes?: number;
  /** Interviewer name/email */
  interviewer?: string;
}

interface SendReminderPayload {
  candidateId: string;
  jobId: string;
  interviewDateTime: string;
  reminderType: "24h" | "1h";
}

export const agentSchedulerTask = task({
  id: "agent-scheduler",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 15_000,
  },
  maxDuration: 60,
  run: async (
    payload: {
      action: "schedule_interview" | "send_reminder";
    } & (ScheduleInterviewPayload | SendReminderPayload),
    { ctx },
  ) => {
    const triggerRunId = ctx.run.id;

    metadata.set("agent", "scheduler").set("action", payload.action).set("status", "processing");

    if (payload.action === "schedule_interview") {
      const p = payload as ScheduleInterviewPayload;

      logger.info("Interview inplannen", {
        candidateId: p.candidateId,
        jobId: p.jobId,
      });

      // Fetch candidate + job details for context
      const [candidateRow, jobRow] = await Promise.all([
        db
          .select()
          .from(candidates)
          .where(eq(candidates.id, p.candidateId))
          .then((r) => r[0]),
        db
          .select()
          .from(jobs)
          .where(eq(jobs.id, p.jobId))
          .then((r) => r[0]),
      ]);

      if (!candidateRow || !jobRow) {
        throw new Error("Kandidaat of vacature niet gevonden");
      }

      // Determine interview slot
      // For now: pick first preferred slot or default to next business day 10:00
      const interviewDate = p.preferredSlots?.[0]
        ? new Date(p.preferredSlots[0])
        : getNextBusinessDay();

      const interviewType = p.interviewType ?? "video";
      const duration = p.durationMinutes ?? 30;

      // Emit interview.scheduled event
      await emitAgentEvent({
        sourceAgent: "scheduler",
        eventType: "interview.scheduled",
        candidateId: p.candidateId,
        jobId: p.jobId,
        matchId: p.matchId,
        screeningCallId: p.screeningCallId,
        payload: {
          interviewDateTime: interviewDate.toISOString(),
          interviewType,
          durationMinutes: duration,
          interviewer: p.interviewer ?? null,
          candidateName: candidateRow.name,
          jobTitle: jobRow.title,
          company: jobRow.company,
        },
        triggerRunId,
      });

      metadata.set("status", "scheduled").set("interviewDate", interviewDate.toISOString());

      logger.info("Interview ingepland", {
        candidateId: p.candidateId,
        jobId: p.jobId,
        interviewDate: interviewDate.toISOString(),
        type: interviewType,
      });

      return {
        action: "schedule_interview",
        interviewDateTime: interviewDate.toISOString(),
        interviewType,
        durationMinutes: duration,
        candidateName: candidateRow.name,
        jobTitle: jobRow.title,
      };
    }

    if (payload.action === "send_reminder") {
      const p = payload as SendReminderPayload;

      logger.info("Interview herinnering verzenden", {
        candidateId: p.candidateId,
        reminderType: p.reminderType,
      });

      await emitAgentEvent({
        sourceAgent: "scheduler",
        eventType: "interview.reminder_sent",
        candidateId: p.candidateId,
        jobId: p.jobId,
        payload: {
          interviewDateTime: p.interviewDateTime,
          reminderType: p.reminderType,
        },
        triggerRunId,
      });

      metadata.set("status", "reminder_sent");

      return {
        action: "send_reminder",
        reminderType: p.reminderType,
        interviewDateTime: p.interviewDateTime,
      };
    }

    throw new Error(`Onbekende actie: ${payload.action}`);
  },
});

// ---------- Helpers ----------

/** Get next business day at 10:00 Amsterdam time. */
function getNextBusinessDay(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setDate(next.getDate() + 1);

  // Skip weekends
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }

  // Set to 10:00 CET/CEST
  next.setHours(10, 0, 0, 0);
  return next;
}
