import { describe, expect, it } from "vitest";
import { parseSearchTerms } from "../src/lib/opdrachten-filters";

describe("parseSearchTerms", () => {
  it("splits comma-separated search terms", () => {
    expect(parseSearchTerms("Java, Amsterdam")).toEqual(["Java", "Amsterdam"]);
  });

  it("splits AND-separated search terms", () => {
    expect(parseSearchTerms("Java AND Amsterdam")).toEqual(["Java", "Amsterdam"]);
  });

  it("splits case-insensitive AND-separated search terms", () => {
    expect(parseSearchTerms("Java and Amsterdam")).toEqual(["Java", "Amsterdam"]);
  });

  it("returns single-element array for simple queries", () => {
    expect(parseSearchTerms("project manager")).toEqual(["project manager"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseSearchTerms("")).toEqual([]);
  });

  it("skips empty segments from consecutive commas", () => {
    expect(parseSearchTerms("Java,,Amsterdam")).toEqual(["Java", "Amsterdam"]);
  });

  it("returns empty array for null/undefined", () => {
    expect(parseSearchTerms(null as unknown as string)).toEqual([]);
    expect(parseSearchTerms(undefined as unknown as string)).toEqual([]);
  });

  it("trims whitespace from each term", () => {
    expect(parseSearchTerms("  Java  ,  Amsterdam  ")).toEqual(["Java", "Amsterdam"]);
  });

  it("handles mixed comma and AND separators", () => {
    expect(parseSearchTerms("Java, Python AND Amsterdam")).toEqual(["Java", "Python", "Amsterdam"]);
  });

  it("does not split on AND inside a word", () => {
    expect(parseSearchTerms("ANDROID")).toEqual(["ANDROID"]);
  });

  it("handles trailing comma gracefully", () => {
    expect(parseSearchTerms("Java,")).toEqual(["Java"]);
  });

  it("handles leading comma gracefully", () => {
    expect(parseSearchTerms(",Amsterdam")).toEqual(["Amsterdam"]);
  });
});
