import { describe, expect, it } from "vitest";
import { stripHtml } from "@/src/lib/html";

describe("stripHtml", () => {
  it("returns empty string for null", () => {
    expect(stripHtml(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(stripHtml(undefined)).toBe("");
  });

  it("strips HTML tags", () => {
    expect(stripHtml("<p>Hello World</p>")).toBe("Hello World");
  });

  it("decodes HTML entities", () => {
    expect(stripHtml("&amp; &lt; &gt; &quot; &#39; &nbsp;")).toBe("& < > \" ' \u00a0".replace("\u00a0", " "));
  });

  it("converts br tags to newlines", () => {
    const result = stripHtml("Line 1<br>Line 2<br/>Line 3");
    expect(result).toContain("\n");
  });

  it("converts block closing tags to newlines", () => {
    const result = stripHtml("<p>Para 1</p><p>Para 2</p>");
    expect(result).toContain("\n");
  });

  it("collapses multiple blank lines into double newline", () => {
    const result = stripHtml("<p>A</p><p></p><p></p><p>B</p>");
    expect(result).not.toMatch(/\n{3,}/);
  });

  it("trims leading and trailing whitespace", () => {
    expect(stripHtml("  <p>text</p>  ")).toBe("text");
  });

  it("handles nested tags", () => {
    expect(stripHtml("<div><span><b>Bold</b></span></div>")).toBe("Bold");
  });
});
