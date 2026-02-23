import { subscribe } from "@/src/lib/event-bus";

export const dynamic = "force-dynamic";

/** SSE endpoint — streams real-time events to connected clients. */
export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = subscribe((event) => {
        const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          unsubscribe();
        }
      });

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 30_000);

      // Cleanup when client disconnects (AbortSignal not available in all runtimes)
      // The try/catch in subscribe and heartbeat handles disconnection gracefully
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
