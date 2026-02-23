import { PostHog } from "posthog-node";

let client: PostHog | null = null;

export function getPostHogServer(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null;
  }

  if (!client) {
    client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      flushAt: 10,
      flushInterval: 5000,
    });
  }

  return client;
}

export function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  getPostHogServer()?.capture({ distinctId, event, properties });
}
