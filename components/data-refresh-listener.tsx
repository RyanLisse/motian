"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useEventSource } from "@/src/hooks/use-event-source";

const DEBOUNCE_MS = 500;

/**
 * Mounts a server-sent event listener and debounces router.refresh() calls.
 * Multiple SSE events within DEBOUNCE_MS coalesce into a single refresh,
 * preventing refresh storms during rapid server mutations on mobile.
 * Renders nothing — side-effect only.
 */
export function DataRefreshListener() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      router.refresh();
      timerRef.current = null;
    }, DEBOUNCE_MS);
  }, [router]);

  useEventSource("/api/events", scheduleRefresh as (e: MessageEvent) => void);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return null;
}
