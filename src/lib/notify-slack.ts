import type {
  SlackNotificationPayload,
  SlackNotificationType,
} from "../services/slack-notifications";

/**
 * Fire-and-forget Slack notification via Trigger.dev.
 * Safe to call even when Slack is not configured — the task handles gracefully.
 *
 * Exception to no-inline-imports: dynamic import is intentional to avoid bundling
 * Trigger.dev SDK in edge routes (Vercel Edge, middleware). Documented per rule.
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
