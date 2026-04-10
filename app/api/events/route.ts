import type { NextRequest } from "next/server";
import { type DataRefreshEvent, deriveRefreshTags } from "@/src/lib/data-refresh";
import { type SSEEvent, subscribe } from "@/src/lib/event-bus";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const encoder = new TextEncoder();

function formatSse(event: DataRefreshEvent) {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function mapEvent(event: SSEEvent): DataRefreshEvent {
  return {
    ...event,
    tags: deriveRefreshTags(event.type),
  };
}

export async function GET(request: NextRequest) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Connection already closed by the runtime.
        }
      };

      const pushEvent = (event: DataRefreshEvent) => {
        if (closed) return;
        controller.enqueue(formatSse(event));
      };

      const unsubscribe = subscribe((event) => {
        pushEvent(mapEvent(event));
      });

      const keepAlive = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 15_000);

      pushEvent({
        type: "system:connected",
        data: {},
        timestamp: new Date().toISOString(),
        tags: [],
      });

      request.signal.addEventListener("abort", close);
    },
    cancel() {
      // Consumers disconnecting will trigger request.signal.abort in production.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
    },
  });
}
