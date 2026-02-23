// In-memory pub/sub event bus for SSE (Server-Sent Events).
// Single-instance only — suitable for Vercel serverless with limited concurrency.

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
