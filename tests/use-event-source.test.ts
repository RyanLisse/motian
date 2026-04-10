import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEventBatcher } from "../src/hooks/use-event-source";

describe("createEventBatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("batches ten realtime events into a single flush inside the debounce window", () => {
    const flush = vi.fn();
    const batcher = createEventBatcher(flush, { delayMs: 500 });

    for (let index = 0; index < 10; index += 1) {
      batcher.push({
        type: "application:updated",
        data: { index },
        timestamp: new Date(index).toISOString(),
        tags: ["pipeline"],
      });
      vi.advanceTimersByTime(40);
    }

    expect(flush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush.mock.calls[0]?.[0]).toHaveLength(10);
  });

  it("drops pending events when cancelled", () => {
    const flush = vi.fn();
    const batcher = createEventBatcher(flush, { delayMs: 500 });

    batcher.push({
      type: "candidate:updated",
      data: {},
      timestamp: new Date().toISOString(),
      tags: ["candidates"],
    });
    batcher.cancel();

    vi.advanceTimersByTime(500);

    expect(flush).not.toHaveBeenCalled();
  });
});
