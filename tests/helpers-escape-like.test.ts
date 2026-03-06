import { describe, expect, it } from "vitest";
import { escapeLike, toTsQueryInput } from "../src/lib/helpers";

describe("escapeLike", () => {
  it("escapes % so it is not a wildcard", () => {
    expect(escapeLike("100%")).toBe("100\\%");
  });

  it("escapes _ so it is not a single-char wildcard", () => {
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes backslash", () => {
    expect(escapeLike("x\\y")).toBe("x\\\\y");
  });

  it("escapes all special chars in one string", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });

  it("leaves normal text unchanged", () => {
    expect(escapeLike("developer")).toBe("developer");
  });
});

describe("toTsQueryInput", () => {
  it("produces prefix terms joined with &", () => {
    expect(toTsQueryInput("java developer")).toBe("java:* & developer:*");
  });

  it("strips non-word chars from terms", () => {
    expect(toTsQueryInput("c++")).toBe("c:*");
  });

  it("returns empty string for empty or whitespace-only input", () => {
    expect(toTsQueryInput("")).toBe("");
    expect(toTsQueryInput("   ")).toBe("");
  });
});
