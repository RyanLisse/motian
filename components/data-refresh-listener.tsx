"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect } from "react";
import { useEventSource } from "@/src/hooks/use-event-source";
import {
  type DataRefreshEvent,
  LOCAL_DATA_CHANGE_EVENT,
  mergeRefreshTags,
  normalizeRefreshTags,
  REFRESH_DEBOUNCE_MS,
  type RefreshTag,
  shouldRefreshPath,
} from "@/src/lib/data-refresh";

const DataMutationContext = createContext<(tags: readonly RefreshTag[]) => void>(() => undefined);

export function DataMutationProvider({ children }: { children: React.ReactNode }) {
  const notify = useCallback((tags: readonly RefreshTag[]) => {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent(LOCAL_DATA_CHANGE_EVENT, {
        detail: {
          tags: tags.length > 0 ? Array.from(tags) : ["all"],
        },
      }),
    );
  }, []);

  return <DataMutationContext.Provider value={notify}>{children}</DataMutationContext.Provider>;
}

export function useDataMutationNotifier() {
  return useContext(DataMutationContext);
}

export function DataRefreshListener() {
  const pathname = usePathname();
  const router = useRouter();

  const handleBatch = useCallback(
    (events: DataRefreshEvent[]) => {
      const tags = mergeRefreshTags(events);
      if (!shouldRefreshPath(pathname, tags)) return;
      router.refresh();
    },
    [pathname, router],
  );

  const { enqueueEvent } = useEventSource({
    url: "/api/events",
    debounceMs: REFRESH_DEBOUNCE_MS,
    onBatch: handleBatch,
  });

  useEffect(() => {
    const handleLocalChange = (event: Event) => {
      const detail =
        event instanceof CustomEvent && event.detail && typeof event.detail === "object"
          ? (event.detail as { tags?: unknown[] })
          : undefined;

      enqueueEvent({
        type: "local:mutation",
        data: {},
        timestamp: new Date().toISOString(),
        tags: detail && Array.isArray(detail.tags) ? normalizeRefreshTags(detail.tags) : ["all"],
      });
    };

    window.addEventListener(LOCAL_DATA_CHANGE_EVENT, handleLocalChange as EventListener);

    return () => {
      window.removeEventListener(LOCAL_DATA_CHANGE_EVENT, handleLocalChange as EventListener);
    };
  }, [enqueueEvent]);

  return null;
}
