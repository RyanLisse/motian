import type { KnownBlock } from "@slack/web-api";
import { WebClient } from "@slack/web-api";

// ========== Types ==========

export type SlackNotificationType =
  | "match:created"
  | "scrape:complete"
  | "scrape:alert"
  | "interview:scheduled"
  | "application:stage_changed";

export type SlackNotificationPayload = {
  type: SlackNotificationType;
  data: Record<string, unknown>;
};

type SlackBlock =
  | { type: "header"; text: { type: "plain_text"; text: string; emoji?: boolean } }
  | { type: "section"; text: { type: "mrkdwn"; text: string }; accessory?: unknown }
  | { type: "divider" }
  | { type: "context"; elements: { type: "mrkdwn"; text: string }[] };

type AnyBlock = KnownBlock;

// ========== Client ==========

let _client: WebClient | null = null;

function getClient(): WebClient | null {
  if (!process.env.SLACK_BOT_TOKEN) return null;
  if (!_client) {
    _client = new WebClient(process.env.SLACK_BOT_TOKEN);
  }
  return _client;
}

function getChannel(): string {
  return process.env.SLACK_CHANNEL_ID ?? "";
}

// ========== Block Kit Formatters ==========

function matchBlocks(data: Record<string, unknown>): SlackBlock[] {
  const candidate = String(data.candidateName ?? "Onbekend");
  const job = String(data.jobTitle ?? "Onbekend");
  const company = data.company ? ` bij ${data.company}` : "";
  const score = Number(data.matchScore ?? 0);
  const recommendation = String(data.recommendation ?? "");
  const matchId = String(data.matchId ?? "");
  const baseUrl = process.env.NEXT_URL ?? "http://localhost:3001";

  const scoreEmoji = score >= 80 ? "🟢" : score >= 60 ? "🟡" : "🟠";

  return [
    {
      type: "header",
      text: { type: "plain_text", text: `${scoreEmoji} Nieuwe match: ${candidate}` },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Kandidaat:* ${candidate}`,
          `*Vacature:* ${job}${company}`,
          `*Score:* ${score}%`,
          recommendation ? `*Aanbeveling:* ${recommendation}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    },
    { type: "divider" },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<${baseUrl}/matches/${matchId}|Bekijk match> · Motian Recruitment`,
        },
      ],
    },
  ];
}

function scrapeCompleteBlocks(data: Record<string, unknown>): SlackBlock[] {
  const platform = String(data.platform ?? "onbekend");
  const jobsFound = Number(data.jobsFound ?? 0);
  const jobsNew = Number(data.jobsNew ?? 0);
  const duplicates = Number(data.duplicates ?? 0);
  const durationMs = Number(data.durationMs ?? 0);
  const status = String(data.status ?? "unknown");

  const statusEmoji = status === "success" ? "✅" : status === "partial" ? "⚠️" : "❌";

  return [
    { type: "header", text: { type: "plain_text", text: `${statusEmoji} Scrape: ${platform}` } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Platform:* ${platform}`,
          `*Status:* ${status}`,
          `*Gevonden:* ${jobsFound} vacatures (${jobsNew} nieuw, ${duplicates} duplicaten)`,
          `*Duur:* ${(durationMs / 1000).toFixed(1)}s`,
        ].join("\n"),
      },
    },
  ];
}

function scrapeAlertBlocks(data: Record<string, unknown>): SlackBlock[] {
  const severity = String(data.severity ?? "warning");
  const alertType = String(data.type ?? "unknown");
  const tripped = data.tripped as string[] | undefined;

  return [
    { type: "header", text: { type: "plain_text", text: `🚨 Scraper alert: ${alertType}` } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Severity:* ${severity}`,
          `*Type:* ${alertType}`,
          tripped?.length ? `*Platforms:* ${tripped.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    },
  ];
}

function interviewBlocks(data: Record<string, unknown>): SlackBlock[] {
  const candidate = String(data.candidateName ?? "Onbekend");
  const job = String(data.jobTitle ?? "Onbekend");
  const scheduledAt = data.scheduledAt ? new Date(String(data.scheduledAt)) : null;
  const interviewType = String(data.type ?? "onbekend");
  const interviewer = String(data.interviewer ?? "Onbekend");

  const dateStr = scheduledAt
    ? scheduledAt.toLocaleString("nl-NL", {
        timeZone: "Europe/Amsterdam",
        dateStyle: "long",
        timeStyle: "short",
      })
    : "Onbekend";

  return [
    { type: "header", text: { type: "plain_text", text: `📅 Interview gepland: ${candidate}` } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Kandidaat:* ${candidate}`,
          `*Vacature:* ${job}`,
          `*Type:* ${interviewType}`,
          `*Wanneer:* ${dateStr}`,
          `*Interviewer:* ${interviewer}`,
        ].join("\n"),
      },
    },
  ];
}

function stageChangedBlocks(data: Record<string, unknown>): SlackBlock[] {
  const candidate = String(data.candidateName ?? "Onbekend");
  const job = String(data.jobTitle ?? "Onbekend");
  const fromStage = String(data.fromStage ?? "");
  const toStage = String(data.toStage ?? "");

  const stageLabels: Record<string, string> = {
    new: "Nieuw",
    screening: "Screening",
    interview: "Interview",
    offer: "Aanbieding",
    hired: "Aangenomen",
    rejected: "Afgewezen",
  };

  return [
    { type: "header", text: { type: "plain_text", text: `📋 Status update: ${candidate}` } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Kandidaat:* ${candidate}`,
          `*Vacature:* ${job}`,
          `*Status:* ${stageLabels[fromStage] ?? fromStage} → *${stageLabels[toStage] ?? toStage}*`,
        ].join("\n"),
      },
    },
  ];
}

// ========== Dispatcher ==========

function buildBlocks(type: SlackNotificationType, data: Record<string, unknown>): SlackBlock[] {
  switch (type) {
    case "match:created":
      return matchBlocks(data);
    case "scrape:complete":
      return scrapeCompleteBlocks(data);
    case "scrape:alert":
      return scrapeAlertBlocks(data);
    case "interview:scheduled":
      return interviewBlocks(data);
    case "application:stage_changed":
      return stageChangedBlocks(data);
  }
}

/** Send a formatted Slack notification. Returns true if sent, false if Slack is not configured. */
export async function sendSlackNotification(payload: SlackNotificationPayload): Promise<boolean> {
  const client = getClient();
  const channel = getChannel();
  if (!client || !channel) return false;

  const blocks = buildBlocks(payload.type, payload.data);

  await client.chat.postMessage({
    channel,
    blocks: blocks as AnyBlock[],
    text: `Motian: ${payload.type}`, // Fallback for notifications
  });

  return true;
}

/** Check if Slack notifications are configured. */
export function isSlackConfigured(): boolean {
  return !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID);
}
