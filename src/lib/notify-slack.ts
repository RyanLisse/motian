import type {
  SlackNotificationPayload,
  SlackNotificationType,
} from "../services/slack-notifications";

/**
 * Fire-and-forget Slack notification via Trigger.dev.
 * Dynamically imports to avoid bundling Trigger.dev SDK in edge routes.
 * Safe to call even when Slack is not configured — the task handles gracefully.
 */
export function notifySlack(type: SlackNotificationType, data: Record<string, unknown>): void {
  const payload: SlackNotificationPayload = { type, data };

  // Dynamic import to keep Trigger.dev SDK out of edge bundles
  import("@trigger.dev/sdk")
    .then(({ tasks }) => tasks.trigger("slack-notification", payload))
    .catch((err) => {
      // Non-fatal: Trigger.dev not available (e.g., local dev without worker)
      console.warn(`[Slack] Failed to queue notification (${type}):`, err);
    });
}
