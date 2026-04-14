import { describe, expect, it } from "vitest";
import { normalizeExternalUrl } from "@/src/lib/external-url";

describe("normalizeExternalUrl", () => {
  it("returns null for null, undefined, and empty inputs", () => {
    expect(normalizeExternalUrl(null)).toBeNull();
    expect(normalizeExternalUrl(undefined)).toBeNull();
    expect(normalizeExternalUrl("")).toBeNull();
    expect(normalizeExternalUrl("   ")).toBeNull();
  });

  it("prepends https:// when no protocol is present", () => {
    expect(normalizeExternalUrl("example.com")).toBe("https://example.com");
    expect(normalizeExternalUrl("www.flextender.nl")).toBe("https://www.flextender.nl");
  });

  it("preserves existing http:// and https:// protocols", () => {
    expect(normalizeExternalUrl("https://example.com")).toBe("https://example.com");
    expect(normalizeExternalUrl("http://example.com")).toBe("http://example.com");
  });

  it("strips trailing slash on domain-only URLs", () => {
    expect(normalizeExternalUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeExternalUrl("example.com/")).toBe("https://example.com");
  });

  it("preserves trailing slash on URLs with deeper paths", () => {
    expect(normalizeExternalUrl("https://example.com/jobs/")).toBe("https://example.com/jobs/");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeExternalUrl("  https://example.com  ")).toBe("https://example.com");
  });
});
