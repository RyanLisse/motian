"use client";

import { useEffect, useRef, useState } from "react";

type EventHandler = (data: Record<string, unknown>) => void;

/**
 * Subscribe to server-sent events from /api/events.
 * Automatically reconnects on disconnection.
 *
 * @param handlers - Map of event type → handler function
 * @returns connection status: "connecting" | "open" | "closed"
 */
export function useEventSource(handlers: Record<string, EventHandler>): string {
  const [status, setStatus] = useState<string>("connecting");
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource("/api/events");
      setStatus("connecting");

      es.onopen = () => setStatus("open");

      es.onerror = () => {
        setStatus("closed");
        es?.close();
        // Reconnect after 5 seconds
        retryTimeout = setTimeout(connect, 5_000);
      };

      // Register handlers for each event type
      for (const eventType of Object.keys(handlersRef.current)) {
        es.addEventListener(eventType, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            handlersRef.current[eventType]?.(data);
          } catch {
            // Ignore malformed events
          }
        });
      }
    }

    connect();

    return () => {
      clearTimeout(retryTimeout);
      es?.close();
    };
  }, []);

  return status;
}
