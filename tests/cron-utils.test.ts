import { describe, expect, it } from "vitest";
import { parseCronNext } from "@/src/lib/cron-utils";

describe("parseCronNext", () => {
  it("returns the next occurrence for a comma-separated hour schedule", () => {
    // "0 6,10,14,18 * * *" — croner evaluates in the system's local timezone,
    // so the UTC hour of the result varies by runner TZ. We verify the result
    // is strictly after `after`, on a minute boundary, and that the *local*
    // hour matches one of the scheduled slots.
    const after = new Date("2026-04-13T07:00:00.000Z");
    const result = parseCronNext("0 6,10,14,18 * * *", after);
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBeGreaterThan(after.getTime());
    expect(result!.getUTCMinutes()).toBe(0);
    // The local hour of the result must be one of the scheduled cron hours
    expect([6, 10, 14, 18]).toContain(result!.getHours());
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
