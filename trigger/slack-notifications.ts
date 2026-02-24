import { task } from "@trigger.dev/sdk";
import {
  type SlackNotificationPayload,
  sendSlackNotification,
} from "../src/services/slack-notifications";

/**
 * Reliable Slack notification delivery via Trigger.dev.
 * Retries up to 5 times with exponential backoff on failure.
 * Fire-and-forget from the caller — Trigger.dev handles delivery.
 */
export const slackNotificationTask = task({
  id: "slack-notification",
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30_000,
    randomize: true,
  },
  run: async (payload: SlackNotificationPayload) => {
    const sent = await sendSlackNotification(payload);

    if (!sent) {
      console.warn("[Slack] Not configured — skipping notification:", payload.type);
      return { sent: false, reason: "not_configured" };
    }

    console.log(`[Slack] Sent ${payload.type} notification`);
    return { sent: true, type: payload.type };
  },
});
