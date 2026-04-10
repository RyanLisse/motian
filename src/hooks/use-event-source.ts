"use client";
import { useEffect, useRef } from "react";

type Handler = (event: MessageEvent) => void;

/**
 * Connects to an SSE endpoint and calls onMessage for each event.
 * Reconnects automatically on connection drop.
 */
export function useEventSource(url: string, onMessage: Handler): void {
  const handlerRef = useRef<Handler>(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      es = new EventSource(url);

      const handler = (e: MessageEvent) => handlerRef.current(e);
      es.addEventListener("message", handler);

      es.addEventListener("error", () => {
        es.close();
        retryTimeout = setTimeout(connect, 5_000);
      });
    }

    connect();

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      es?.close();
    };
  }, [url]);
}
