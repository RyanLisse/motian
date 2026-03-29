import { logger, metadata, task } from "@trigger.dev/sdk";
import { emitAgentEvent } from "@/src/services/agent-events";
import { getCandidateById } from "@/src/services/candidates";

// ---------- Types ----------

type Channel = "email" | "whatsapp" | "sms";

interface NotificationPayload {
  channel: Channel;
  candidateId: string;
  jobId?: string;
  matchId?: string;
  screeningCallId?: string;
  /** Template key, e.g. "screening_invite", "match_notification", "interview_confirmation" */
  template: string;
  /** Recipient email or phone (resolved from candidate if omitted) */
  recipient?: string;
  /** Template variables for substitution */
  variables?: Record<string, string>;
  /** Override subject line (email only) */
  subject?: string;
}

// ---------- Email sending via Resend ----------

async function sendEmail(to: string, subject: string, htmlBody: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY niet geconfigureerd");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? "Motian <noreply@motian.nl>",
      to: [to],
      subject,
      html: htmlBody,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API fout: ${response.status} ${body}`);
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

// ---------- Email templates (Dutch) ----------

const EMAIL_TEMPLATES: Record<
  string,
  {
    subject: (vars: Record<string, string>) => string;
    body: (vars: Record<string, string>) => string;
  }
> = {
  screening_invite: {
    subject: (v) => `Uitnodiging screeninggesprek — ${v.jobTitle ?? "vacature"}`,
    body: (v) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hallo ${v.candidateName ?? "kandidaat"},</h2>
        <p>Goed nieuws! Op basis van uw profiel hebben we een sterke match gevonden met de functie
        <strong>${v.jobTitle ?? ""}</strong>${v.company ? ` bij ${v.company}` : ""}.</p>
        <p>We willen u graag uitnodigen voor een kort screeninggesprek om uw beschikbaarheid
        en wensen te bespreken.</p>
        <p>Match score: <strong>${v.matchScore ?? ""}%</strong></p>
        ${v.callLink ? `<p><a href="${v.callLink}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Start gesprek</a></p>` : ""}
        <p>Met vriendelijke groet,<br>Het Motian team</p>
      </div>
    `,
  },
  match_notification: {
    subject: (v) => `Nieuwe match gevonden — ${v.jobTitle ?? "vacature"}`,
    body: (v) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hallo ${v.candidateName ?? "kandidaat"},</h2>
        <p>We hebben een nieuwe vacature gevonden die goed bij uw profiel past:</p>
        <p><strong>${v.jobTitle ?? ""}</strong>${v.company ? ` — ${v.company}` : ""}${v.location ? ` (${v.location})` : ""}</p>
        <p>Match score: <strong>${v.matchScore ?? ""}%</strong></p>
        <p>Heeft u interesse? Reageer op deze e-mail of log in op het platform.</p>
        <p>Met vriendelijke groet,<br>Het Motian team</p>
      </div>
    `,
  },
  interview_confirmation: {
    subject: (v) => `Bevestiging interview — ${v.jobTitle ?? "vacature"}`,
    body: (v) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hallo ${v.candidateName ?? "kandidaat"},</h2>
        <p>Uw interview voor <strong>${v.jobTitle ?? ""}</strong> is bevestigd.</p>
        ${v.dateTime ? `<p>Datum en tijd: <strong>${v.dateTime}</strong></p>` : ""}
        ${v.interviewLink ? `<p><a href="${v.interviewLink}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Deelnemen aan interview</a></p>` : ""}
        <p>Met vriendelijke groet,<br>Het Motian team</p>
      </div>
    `,
  },
};

// ---------- Task ----------

/**
 * Communicator Agent — sends notifications across channels.
 *
 * Channels:
 *   - email: Via Resend API with Dutch templates
 *   - whatsapp: Via existing Baileys gateway (future)
 *   - sms: Placeholder for future integration
 *
 * Emits notification.email_sent / notification.whatsapp_sent events.
 */
export const agentCommunicatorTask = task({
  id: "agent-communicator",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 15_000,
  },
  maxDuration: 60,
  run: async (payload: NotificationPayload, { ctx }) => {
    const triggerRunId = ctx.run.id;

    metadata
      .set("agent", "communicator")
      .set("channel", payload.channel)
      .set("template", payload.template)
      .set("status", "sending");

    logger.info("Communicator agent gestart", {
      channel: payload.channel,
      template: payload.template,
      candidateId: payload.candidateId,
    });

    const variables = payload.variables ?? {};

    if (payload.channel === "email") {
      const template = EMAIL_TEMPLATES[payload.template];
      if (!template) throw new Error(`Onbekend e-mail template: ${payload.template}`);

      // Resolve recipient: use provided value, or look up candidate email
      let recipient = payload.recipient;
      if (!recipient) {
        const candidate = await getCandidateById(payload.candidateId);
        recipient = candidate?.email ?? undefined;
        // Also inject candidateName into variables if not already set
        if (candidate?.name && !variables.candidateName) {
          variables.candidateName = candidate.name;
        }
      }
      if (!recipient) throw new Error("E-mail ontvanger ontbreekt");

      const subject = payload.subject ?? template.subject(variables);
      const body = template.body(variables);

      const emailId = await sendEmail(recipient, subject, body);

      await emitAgentEvent({
        sourceAgent: "communicator",
        eventType: "notification.email_sent",
        candidateId: payload.candidateId,
        jobId: payload.jobId,
        matchId: payload.matchId,
        screeningCallId: payload.screeningCallId,
        payload: {
          channel: "email",
          template: payload.template,
          recipient,
          emailId,
          subject,
        },
        triggerRunId,
      });

      metadata.set("status", "sent").set("emailId", emailId);

      logger.info("E-mail verzonden", { emailId, recipient, template: payload.template });

      return { channel: "email", emailId, recipient, subject };
    }

    if (payload.channel === "whatsapp") {
      // WhatsApp via existing Baileys gateway — emit event for async processing
      await emitAgentEvent({
        sourceAgent: "communicator",
        eventType: "notification.whatsapp_sent",
        candidateId: payload.candidateId,
        jobId: payload.jobId,
        matchId: payload.matchId,
        payload: {
          channel: "whatsapp",
          template: payload.template,
          recipient: payload.recipient,
          variables,
        },
        triggerRunId,
      });

      metadata.set("status", "queued");
      logger.info("WhatsApp bericht in wachtrij", { template: payload.template });
      return { channel: "whatsapp", status: "queued" };
    }

    // SMS — placeholder
    logger.warn("SMS kanaal nog niet geïmplementeerd", { template: payload.template });
    return { channel: "sms", status: "not_implemented" };
  },
});
