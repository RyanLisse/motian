"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

// TanStack Virtual v3 subscribes via useLayoutEffect (_didMount). When a
// useState callback-ref fires, React queues a re-render but _didMount has
// already run with null → no scroll-element subscription → 0 virtual items.
// Fix: mirror the element into a ref so getScrollElement() returns a non-null
// value synchronously at commit time, while state still drives reactive effects.
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const DEFAULT_MOBILE_OVERSCAN = 4;
const DEFAULT_DESKTOP_OVERSCAN = 6;

type ScrollMode = "self" | "parent";

export function resolveVirtualListOverscan(overscan: number | undefined, isMobile: boolean) {
  return overscan ?? (isMobile ? DEFAULT_MOBILE_OVERSCAN : DEFAULT_DESKTOP_OVERSCAN);
}

function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null;

  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

function measureScrollMargin(node: HTMLElement, scrollElement: HTMLElement) {
  const nodeRect = node.getBoundingClientRect();
  const scrollRect = scrollElement.getBoundingClientRect();
  return nodeRect.top - scrollRect.top + scrollElement.scrollTop;
}

export interface VirtualListProps<T> {
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey?: (item: T, index: number) => string | number;
  estimateSize?: (item: T, index: number) => number;
  overscan?: number;
  gap?: number;
  scrollMode?: ScrollMode;
  smoothScroll?: boolean;
  className?: string;
  contentClassName?: string;
  itemClassName?: string;
}

export function VirtualList<T>({
  items,
  renderItem,
  getItemKey,
  estimateSize,
  overscan,
  gap = 0,
  scrollMode = "self",
  smoothScroll = true,
  className,
  contentClassName,
  itemClassName,
}: VirtualListProps<T>) {
  const isMobile = useIsMobile();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selfScrollRef = useRef<HTMLDivElement | null>(null);
  const [selfScrollElement, setSelfScrollElement] = useState<HTMLDivElement | null>(null);

  const setSelfScroll = useCallback((node: HTMLDivElement | null) => {
    selfScrollRef.current = node;
    setSelfScrollElement(node);
  }, []);
  const [parentScrollElement, setParentScrollElement] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const resolvedOverscan = resolveVirtualListOverscan(overscan, isMobile);

  const updateParentScrollState = useCallback(() => {
    if (scrollMode !== "parent") return;
    const root = rootRef.current;
    if (!root) return;

    const nextScrollParent = findScrollParent(root);
    setParentScrollElement(nextScrollParent);

    if (nextScrollParent) {
      setScrollMargin(measureScrollMargin(root, nextScrollParent));
    }
  }, [scrollMode]);

  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (scrollMode === "parent" && node) {
        const nextScrollParent = findScrollParent(node);
        setParentScrollElement(nextScrollParent);
        if (nextScrollParent) {
          setScrollMargin(measureScrollMargin(node, nextScrollParent));
        }
      }
    },
    [scrollMode],
  );

  useEffect(() => {
    if (scrollMode !== "parent") return undefined;
    updateParentScrollState();

    const root = rootRef.current;
    const scrollElement = parentScrollElement;

    const handleResize = () => updateParentScrollState();
    window.addEventListener("resize", handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && root && scrollElement) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(root);
      resizeObserver.observe(scrollElement);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, [parentScrollElement, scrollMode, updateParentScrollState]);

  const scrollElement = scrollMode === "parent" ? parentScrollElement : selfScrollElement;

  useEffect(() => {
    if (!smoothScroll || !scrollElement) return undefined;

    const previousScrollBehavior = scrollElement.style.scrollBehavior;
    scrollElement.style.scrollBehavior = "smooth";

    return () => {
      scrollElement.style.scrollBehavior = previousScrollBehavior;
    };
  }, [scrollElement, smoothScroll]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => (scrollMode === "parent" ? parentScrollElement : selfScrollRef.current),
    estimateSize: (index) => estimateSize?.(items[index] as T, index) ?? 160,
    getItemKey: (index) => getItemKey?.(items[index] as T, index) ?? index,
    overscan: resolvedOverscan,
    gap,
    scrollMargin: scrollMode === "parent" ? scrollMargin : 0,
    measureElement: (element) => element?.getBoundingClientRect().height ?? 0,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const isParentModeReady = scrollMode === "self" || parentScrollElement !== null;

  const absoluteItems = useMemo(
    () =>
      virtualItems.map((virtualItem) => {
        const item = items[virtualItem.index] as T;
        const itemKey = getItemKey?.(item, virtualItem.index) ?? virtualItem.key;
        const translateY =
          scrollMode === "parent" ? virtualItem.start - scrollMargin : virtualItem.start;

        return (
          <div
            key={itemKey}
            ref={virtualizer.measureElement}
            data-index={virtualItem.index}
            data-virtual-list-item="true"
            className={cn("absolute left-0 top-0 w-full", itemClassName)}
            style={{ transform: `translateY(${translateY}px)` }}
          >
            {renderItem(item, virtualItem.index)}
          </div>
        );
      }),
    [
      getItemKey,
      itemClassName,
      items,
      renderItem,
      scrollMargin,
      scrollMode,
      virtualItems,
      virtualizer.measureElement,
    ],
  );

  if (scrollMode === "parent" && !isParentModeReady) {
    return (
      <div ref={setRootRef} className={className}>
        {items.map((item, index) => (
          <div key={getItemKey?.(item, index) ?? index}>{renderItem(item, index)}</div>
        ))}
      </div>
    );
  }

  const virtualizedContent = (
    <div
      data-virtual-list="true"
      className={cn("relative w-full", contentClassName)}
      style={{ height: `${virtualizer.getTotalSize()}px` }}
    >
      {absoluteItems}
    </div>
  );

  if (scrollMode === "parent") {
    return (
      <div ref={setRootRef} className={className}>
        {virtualizedContent}
      </div>
    );
  }

  return (
    <div ref={setRootRef} className="flex min-h-0 flex-1 flex-col">
      <div ref={setSelfScroll} className={cn("min-h-0 flex-1 overflow-y-auto", className)}>
        {virtualizedContent}
      </div>
    </div>
  );
}
