"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useEventSource } from "@/src/hooks/use-event-source";
import { createRefreshCoalescer } from "@/src/lib/refresh-coalescer";

const DEFAULT_REFRESH_DEBOUNCE_MS = 300;

/**
 * Invisible component that listens for SSE events and triggers router.refresh()
 * when relevant data changes. Drop into any page that shows data modified by agents.
 */
export function DataRefreshListener({
  events,
  debounceMs = DEFAULT_REFRESH_DEBOUNCE_MS,
}: {
  events: string[];
  debounceMs?: number;
}) {
  const router = useRouter();
  const refreshCoalescer = useMemo(
    () =>
      createRefreshCoalescer(
        () => {
          router.refresh();
        },
        { delayMs: debounceMs },
      ),
    [debounceMs, router],
  );

  const handlers = useMemo(() => {
    const map: Record<string, () => void> = {};
    for (const event of events) {
      map[event] = () => refreshCoalescer.trigger();
    }
    return map;
  }, [events, refreshCoalescer]);

  useEventSource(handlers);

  useEffect(() => {
    function onDataChanged() {
      refreshCoalescer.trigger();
    }
    window.addEventListener("motian-data-changed", onDataChanged);
    return () => {
      window.removeEventListener("motian-data-changed", onDataChanged);
      refreshCoalescer.cancel();
    };
  }, [refreshCoalescer]);

  return null;
}
