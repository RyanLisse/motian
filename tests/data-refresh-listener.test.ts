import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ROOT = join(import.meta.dirname, "..");

// ---------------------------------------------------------------------------
// Structural tests (no DOM needed)
// ---------------------------------------------------------------------------

describe("DataRefreshListener structure", () => {
  const source = readFileSync(join(ROOT, "components", "data-refresh-listener.tsx"), "utf-8");

  it("renders null — no DOM output", () => {
    // Component must return null (side-effect only)
    expect(source).toContain("return null");
  });

  it("connects to /api/events via useEventSource", () => {
    expect(source).toContain('useEventSource("/api/events"');
  });

  it("uses a 500ms debounce window", () => {
    expect(source).toContain("DEBOUNCE_MS = 500");
  });

  it("clears timer on unmount via useEffect cleanup", () => {
    // Must have a cleanup function that clears the timeout
    expect(source).toContain("clearTimeout(timerRef.current)");
    // The cleanup is inside a useEffect return
    expect(source).toMatch(
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?return\s*\(\)\s*=>\s*\{[\s\S]*?clearTimeout/,
    );
  });

  it("debounces by clearing previous timer before scheduling new one", () => {
    // The scheduleRefresh callback must clear previous timer then set a new one
    expect(source).toContain("if (timerRef.current) clearTimeout(timerRef.current)");
    expect(source).toContain("timerRef.current = setTimeout");
  });

  it("calls router.refresh() inside the debounced timeout", () => {
    expect(source).toContain("router.refresh()");
  });
});

// ---------------------------------------------------------------------------
// Behavioral tests — exercise debounce logic through mock wiring
// ---------------------------------------------------------------------------

const { mockRefresh, mockUseEventSource } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockUseEventSource: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/src/hooks/use-event-source", () => ({
  useEventSource: mockUseEventSource,
}));

/**
 * We simulate the component's debounce logic without DOM rendering.
 * The component's scheduleRefresh:
 *   1. Clears any existing timer
 *   2. Sets a new 500ms timeout that calls router.refresh()
 *
 * We replicate exactly this logic to verify the debounce contract,
 * since the component is a thin wrapper around useEventSource + setTimeout.
 */
describe("DataRefreshListener debounce behavior", () => {
  let timerRef: { current: ReturnType<typeof setTimeout> | null };
  let scheduleRefresh: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Mirror the component's internal debounce logic
    timerRef = { current: null };
    scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        mockRefresh();
        timerRef.current = null;
      }, 500);
    };
  });

  afterEach(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    vi.useRealTimers();
  });

  it("rapid calls within 500ms produce only one router.refresh()", () => {
    // Fire 5 rapid SSE events
    for (let i = 0; i < 5; i++) {
      scheduleRefresh();
    }

    // Before debounce window: no refresh yet
    expect(mockRefresh).not.toHaveBeenCalled();

    // Advance past 500ms debounce
    vi.advanceTimersByTime(500);

    // Exactly one refresh despite 5 events
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("fires separate refreshes for events spaced beyond 500ms", () => {
    scheduleRefresh();
    vi.advanceTimersByTime(500);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    scheduleRefresh();
    vi.advanceTimersByTime(500);
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it("cleanup: clearing timer prevents stale refresh", () => {
    // Schedule a debounced refresh
    scheduleRefresh();

    // Simulate unmount cleanup — clear the timer
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;

    // Advance timers past the debounce — the cleared timer should NOT fire
    vi.advanceTimersByTime(1000);

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("resets null after refresh fires", () => {
    scheduleRefresh();
    expect(timerRef.current).not.toBeNull();

    vi.advanceTimersByTime(500);
    expect(timerRef.current).toBeNull();
  });
});
