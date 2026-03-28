"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useEventSource } from "@/src/hooks/use-event-source";

/**
 * Invisible component that listens for SSE events and triggers router.refresh()
 * when relevant data changes. Drop into any page that shows data modified by agents.
 */
export function DataRefreshListener({ events }: { events: string[] }) {
  const router = useRouter();

  const handlers = useMemo(() => {
    const map: Record<string, () => void> = {};
    for (const event of events) {
      map[event] = () => router.refresh();
    }
    return map;
  }, [router, events]);

  useEventSource(handlers);

  useEffect(() => {
    function onDataChanged() {
      router.refresh();
    }
    window.addEventListener("motian-data-changed", onDataChanged);
    return () => window.removeEventListener("motian-data-changed", onDataChanged);
  }, [router]);

  return null;
}
