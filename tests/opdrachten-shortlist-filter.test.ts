import { describe, expect, it } from "vitest";
import { parseOpdrachtenFilters, parseVacatureShortlistFlag } from "../src/lib/opdrachten-filters";

describe("parseVacatureShortlistFlag", () => {
  it("accepts common truthy values", () => {
    expect(parseVacatureShortlistFlag("1")).toBe(true);
    expect(parseVacatureShortlistFlag("true")).toBe(true);
    expect(parseVacatureShortlistFlag("YES")).toBe(true);
    expect(parseVacatureShortlistFlag("ja")).toBe(true);
  });

  it("rejects empty or other strings", () => {
    expect(parseVacatureShortlistFlag(null)).toBe(false);
    expect(parseVacatureShortlistFlag("")).toBe(false);
    expect(parseVacatureShortlistFlag("0")).toBe(false);
    expect(parseVacatureShortlistFlag("no")).toBe(false);
  });
});

describe("parseOpdrachtenFilters shortlist", () => {
  it("reads alleenShortlist from URL", () => {
    const parsed = parseOpdrachtenFilters(new URLSearchParams("alleenShortlist=1"));
    expect(parsed.onlyShortlist).toBe(true);
  });

  it("reads shortlist alias", () => {
    const parsed = parseOpdrachtenFilters(new URLSearchParams("shortlist=true"));
    expect(parsed.onlyShortlist).toBe(true);
  });
});
