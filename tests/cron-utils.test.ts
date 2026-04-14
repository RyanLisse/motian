import { describe, expect, it } from "vitest";
import { parseCronNext } from "@/src/lib/cron-utils";

describe("parseCronNext", () => {
  it("returns the next occurrence for a comma-separated hour schedule", () => {
    // "0 6,10,14,18 * * *" — after 07:00 UTC (= 09:00 Amsterdam), the next
    // occurrence is 10:00 Amsterdam which equals 08:00 UTC (CEST, UTC+2).
    const after = new Date("2026-04-13T07:00:00.000Z");
    const result = parseCronNext("0 6,10,14,18 * * *", after);
    expect(result).not.toBeNull();
    if (!result) {
      throw new Error("Expected parseCronNext to return a date");
    }
    // Verify the next run is strictly after `after` and on the minute boundary
    expect(result.getTime()).toBeGreaterThan(after.getTime());
    expect(result.getUTCMinutes()).toBe(0);
    // Verify it is the expected 10:00 Amsterdam slot (08:00 UTC in CEST)
    expect(result.getUTCHours()).toBe(8);
  });

  it("returns a non-null Date for a simple daily schedule", () => {
    const result = parseCronNext("0 6 * * *");
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Date);
  });

  it("returns a non-null Date for a 6-field cron expression", () => {
    const result = parseCronNext("0 0 */4 * * *");
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Date);
  });

  it("returns null for null input", () => {
    expect(parseCronNext(null)).toBeNull();
  });

  it("returns null for empty string input", () => {
    expect(parseCronNext("")).toBeNull();
  });

  it("returns null for an invalid expression without throwing", () => {
    expect(() => parseCronNext("invalid cron")).not.toThrow();
    expect(parseCronNext("invalid cron")).toBeNull();
  });
});
