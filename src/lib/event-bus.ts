// In-memory pub/sub event bus for SSE (Server-Sent Events).
// Single-instance only — suitable for Vercel serverless with limited concurrency.

import type { DeferredEmbeddingSyncPayload } from "../services/embedding";

export type SSEEvent = {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
};

type Listener = (event: SSEEvent) => void;

const listeners = new Set<Listener>();

/** Subscribe to all events. Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Publish an event to all connected SSE clients. */
export function publish(type: string, data: Record<string, unknown> = {}): void {
  const event: SSEEvent = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      listeners.delete(listener);
    }
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function queueDeferredEmbeddingSync(
  payload: DeferredEmbeddingSyncPayload,
): Promise<void> {
  publish("embedding:needed", payload);

  let triggerTasks: typeof import("@trigger.dev/sdk").tasks;
  try {
    const sdk = await import("@trigger.dev/sdk");
    triggerTasks = sdk.tasks;
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("[embedding] Trigger.dev SDK unavailable for deferred sync:", message);
    publish("embedding:queue_failed", { ...payload, error: message });
    return;
  }

  try {
    const handle = await triggerTasks.trigger("defer-embedding-sync", payload);
    publish("embedding:queued", { ...payload, runId: handle.id });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("[embedding] Failed to queue deferred sync:", message);
    publish("embedding:queue_failed", { ...payload, error: message });
  }
}
