import { describe, expect, it } from "vitest";
import { sanitizeHours } from "../packages/scrapers/src/lib/utils";

describe("sanitizeHours", () => {
  it("should return the number if it is within range", () => {
    expect(sanitizeHours(20)).toBe(20);
    expect(sanitizeHours(40)).toBe(40);
    expect(sanitizeHours(168)).toBe(168);
  });

  it("should return undefined if the number is too high", () => {
    expect(sanitizeHours(169)).toBeUndefined();
    expect(sanitizeHours(1000)).toBeUndefined();
  });

  it("should return undefined if input is not a positive number", () => {
    expect(sanitizeHours(0)).toBeUndefined();
    expect(sanitizeHours(-10)).toBeUndefined();
    expect(sanitizeHours(undefined)).toBeUndefined();
    expect(sanitizeHours(null as unknown as number)).toBeUndefined();
    expect(sanitizeHours(NaN)).toBeUndefined();
  });

  it("should handle potentially numeric input safely", () => {
    // These should return undefined because sanitizeHours expects number | undefined
    expect(sanitizeHours("20" as unknown as number)).toBeUndefined();
    expect(sanitizeHours("40" as unknown as number)).toBeUndefined();
  });
});
