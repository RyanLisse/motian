"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type DataRefreshEvent, normalizeDataRefreshEvent } from "@/src/lib/data-refresh";
import { createRefreshCoalescer } from "@/src/lib/refresh-coalescer";

export type EventSourceStatus = "idle" | "connecting" | "open" | "error" | "unsupported";

export function createEventBatcher(
  flush: (events: DataRefreshEvent[]) => void,
  { delayMs }: { delayMs: number },
) {
  let pending: DataRefreshEvent[] = [];

  const coalescer = createRefreshCoalescer(
    () => {
      if (pending.length === 0) return;
      const batch = pending;
      pending = [];
      flush(batch);
    },
    { delayMs },
  );

  return {
    push(event: DataRefreshEvent) {
      pending.push(event);
      coalescer.trigger();
    },
    cancel() {
      pending = [];
      coalescer.cancel();
    },
  };
}

export function useEventSource({
  url,
  onBatch,
  enabled = true,
  debounceMs,
}: {
  url: string;
  onBatch: (events: DataRefreshEvent[]) => void;
  enabled?: boolean;
  debounceMs: number;
}) {
  const [status, setStatus] = useState<EventSourceStatus>("idle");
  const onBatchRef = useRef(onBatch);
  const batcherRef = useRef(
    createEventBatcher((events) => onBatchRef.current(events), { delayMs: debounceMs }),
  );

  onBatchRef.current = onBatch;

  useEffect(() => {
    batcherRef.current.cancel();
    batcherRef.current = createEventBatcher((events) => onBatchRef.current(events), {
      delayMs: debounceMs,
    });

    return () => {
      batcherRef.current.cancel();
    };
  }, [debounceMs]);

  const enqueueEvent = useCallback((event: DataRefreshEvent) => {
    batcherRef.current.push(event);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      setStatus("unsupported");
      return;
    }

    setStatus("connecting");

    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setStatus("open");
    };

    eventSource.onmessage = (message) => {
      const nextEvent = normalizeDataRefreshEvent(message.data);
      if (!nextEvent) return;
      enqueueEvent(nextEvent);
    };

    eventSource.onerror = () => {
      setStatus("error");
    };

    return () => {
      eventSource.close();
      setStatus("idle");
    };
  }, [enabled, enqueueEvent, url]);

  return { enqueueEvent, status };
}
