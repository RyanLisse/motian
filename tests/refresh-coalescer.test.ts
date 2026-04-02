import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRefreshCoalescer } from "../src/lib/refresh-coalescer";

describe("createRefreshCoalescer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("coalesces multiple triggers into a single refresh call", () => {
    const refresh = vi.fn();
    const coalescer = createRefreshCoalescer(refresh, { delayMs: 150 });

    coalescer.trigger();
    coalescer.trigger();
    coalescer.trigger();

    vi.advanceTimersByTime(149);
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending refresh", () => {
    const refresh = vi.fn();
    const coalescer = createRefreshCoalescer(refresh, { delayMs: 150 });

    coalescer.trigger();
    coalescer.cancel();

    vi.advanceTimersByTime(150);
    expect(refresh).not.toHaveBeenCalled();
  });
});
