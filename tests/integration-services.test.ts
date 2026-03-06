/**
 * Integration tests for service-level logic.
 *
 * Tests utility functions, event bus, and GDPR helpers that don't require
 * a live database connection.
 */
import { describe, expect, it } from "vitest";

// ─── 1. escapeLike utility ───────────────────────────────────────────

describe("escapeLike", () => {
  let escapeLike: (s: string) => string;

  it("imports correctly", async () => {
    const mod = await import("../src/lib/helpers");
    escapeLike = mod.escapeLike;
    expect(typeof escapeLike).toBe("function");
  });

  it("escapes % wildcard", async () => {
    const { escapeLike } = await import("../src/lib/helpers");
    expect(escapeLike("100%")).toBe("100\\%");
  });

  it("escapes _ wildcard", async () => {
    const { escapeLike } = await import("../src/lib/helpers");
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes backslash", async () => {
    const { escapeLike } = await import("../src/lib/helpers");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("escapes combined wildcards", async () => {
    const { escapeLike } = await import("../src/lib/helpers");
    expect(escapeLike("%_\\")).toBe("\\%\\_\\\\");
  });

  it("passes through normal strings unchanged", async () => {
    const { escapeLike } = await import("../src/lib/helpers");
    expect(escapeLike("hello world")).toBe("hello world");
    expect(escapeLike("")).toBe("");
    expect(escapeLike("Utrecht")).toBe("Utrecht");
  });
});

// ─── 2. Event Bus ────────────────────────────────────────────────────

describe("Event Bus", () => {
  it("publishes events to subscribers", async () => {
    const { subscribe, publish } = await import("../src/lib/event-bus");
    const received: Array<{ type: string; data: Record<string, unknown> }> = [];

    const unsubscribe = subscribe((event) => {
      received.push({ type: event.type, data: event.data });
    });

    publish("test:event", { foo: "bar" });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("test:event");
    expect(received[0].data).toEqual({ foo: "bar" });

    unsubscribe();
  });

  it("unsubscribe stops receiving events", async () => {
    const { subscribe, publish } = await import("../src/lib/event-bus");
    const received: string[] = [];

    const unsubscribe = subscribe((event) => {
      received.push(event.type);
    });

    publish("before", {});
    unsubscribe();
    publish("after", {});

    expect(received).toEqual(["before"]);
  });

  it("handles multiple subscribers", async () => {
    const { subscribe, publish } = await import("../src/lib/event-bus");
    const received1: string[] = [];
    const received2: string[] = [];

    const unsub1 = subscribe((e) => received1.push(e.type));
    const unsub2 = subscribe((e) => received2.push(e.type));

    publish("multi", {});

    expect(received1).toEqual(["multi"]);
    expect(received2).toEqual(["multi"]);

    unsub1();
    unsub2();
  });

  it("includes ISO timestamp in events", async () => {
    const { subscribe, publish } = await import("../src/lib/event-bus");
    let timestamp = "";

    const unsubscribe = subscribe((event) => {
      timestamp = event.timestamp;
    });

    publish("ts:test", {});
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    unsubscribe();
  });
});

// ─── 3. GDPR types and export structure ──────────────────────────────

describe("GDPR module structure", () => {
  it(
    "exports expected functions",
    async () => {
      const gdpr = await import("../src/services/gdpr");
      expect(typeof gdpr.exportCandidateData).toBe("function");
      expect(typeof gdpr.eraseCandidateData).toBe("function");
      expect(typeof gdpr.findExpiredRetentionCandidates).toBe("function");
      expect(typeof gdpr.scrubContactData).toBe("function");
      expect(typeof gdpr.getAuditLog).toBe("function");
    },
    15_000,
  );
});

// ─── 4. Schema exports ──────────────────────────────────────────────

describe("Database schema exports", () => {
  it("exports all expected tables", async () => {
    const schema = await import("../src/db/schema");
    const expectedTables = [
      "scraperConfigs",
      "scrapeResults",
      "jobs",
      "candidates",
      "jobMatches",
      "applications",
      "interviews",
      "messages",
      "gdprAuditLog",
    ];
    for (const table of expectedTables) {
      expect(schema).toHaveProperty(table);
    }
  });
});

// ─── 5. Helpers ──────────────────────────────────────────────────────

describe("Helpers module", () => {
  it("withRetry retries on retryable errors", async () => {
    const { withRetry } = await import("../src/lib/retry");
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) {
          const err = new Error("rate limited") as Error & { status: number };
          err.status = 429;
          throw err;
        }
        return "ok";
      },
      { maxAttempts: 3, baseDelayMs: 10, label: "test" },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("withRetry throws non-retryable errors immediately", async () => {
    const { withRetry } = await import("../src/lib/retry");
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          const err = new Error("not found") as Error & { status: number };
          err.status = 404;
          throw err;
        },
        { maxAttempts: 3, baseDelayMs: 10 },
      ),
    ).rejects.toThrow("not found");
    expect(calls).toBe(1);
  });
});
