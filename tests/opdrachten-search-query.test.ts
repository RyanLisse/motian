import { describe, expect, it } from "vitest";

import { normalizeOpdrachtenSearchQuery } from "../src/lib/opdrachten-filters";

describe("normalizeOpdrachtenSearchQuery", () => {
  it("suppresses empty and one-character queries", () => {
    expect(normalizeOpdrachtenSearchQuery("")).toBeUndefined();
    expect(normalizeOpdrachtenSearchQuery("a")).toBeUndefined();
    expect(normalizeOpdrachtenSearchQuery(" a ")).toBeUndefined();
  });

  it("keeps trimmed queries with two or more characters", () => {
    expect(normalizeOpdrachtenSearchQuery("ab")).toBe("ab");
    expect(normalizeOpdrachtenSearchQuery(" manager ")).toBe("manager");
  });
});
