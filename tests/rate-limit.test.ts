import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "../src/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const createLimiter = (interval = 60_000, limit = 5) => rateLimit({ interval, limit });

  it("first request succeeds with correct remaining count", () => {
    const limiter = createLimiter(60_000, 5);
    const result = limiter.check("user-1");

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("N requests within limit all succeed with decreasing remaining", () => {
    const limiter = createLimiter(60_000, 5);

    for (let i = 0; i < 5; i++) {
      const result = limiter.check("user-1");
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
  });

  it("request N+1 over limit fails with success false and remaining 0", () => {
    const limiter = createLimiter(60_000, 3);

    for (let i = 0; i < 3; i++) {
      limiter.check("user-1");
    }

    const result = limiter.check("user-1");
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("after interval passes window resets and requests succeed again", () => {
    const limiter = createLimiter(60_000, 2);

    limiter.check("user-1");
    limiter.check("user-1");
    const blocked = limiter.check("user-1");
    expect(blocked.success).toBe(false);

    vi.advanceTimersByTime(60_000);

    const result = limiter.check("user-1");
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("different keys are independent", () => {
    const limiter = createLimiter(60_000, 1);

    const a = limiter.check("a");
    expect(a.success).toBe(true);

    const aBlocked = limiter.check("a");
    expect(aBlocked.success).toBe(false);

    const b = limiter.check("b");
    expect(b.success).toBe(true);
    expect(b.remaining).toBe(0);
  });

  it("prune cleans up entries older than 2x interval", () => {
    const interval = 10_000;
    const limiter = createLimiter(interval, 5);

    limiter.check("old-key");

    // Advance past 2x interval so the entry becomes stale
    vi.advanceTimersByTime(interval * 2 + 1);

    // Trigger prune via a new check on a different key
    limiter.check("new-key");

    // The old key should have been pruned, so a new check starts fresh
    const result = limiter.check("old-key");
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("reset timestamp is correctly set to now + interval", () => {
    const interval = 30_000;
    const limiter = createLimiter(interval, 5);

    const now = Date.now();
    const result = limiter.check("user-1");

    expect(result.reset).toBe(now + interval);
  });

  it("remaining never goes below 0", () => {
    const limiter = createLimiter(60_000, 2);

    limiter.check("user-1");
    limiter.check("user-1");

    // Exceed limit multiple times
    for (let i = 0; i < 10; i++) {
      const result = limiter.check("user-1");
      expect(result.remaining).toBe(0);
      expect(result.success).toBe(false);
    }
  });
});
