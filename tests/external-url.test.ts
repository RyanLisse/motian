import { describe, expect, it } from "vitest";
import { normalizeExternalUrl } from "../src/lib/external-url";

describe("normalizeExternalUrl", () => {
  it("accepts valid http(s) urls", () => {
    expect(normalizeExternalUrl("https://example.com/path")).toBe("https://example.com/path");
    expect(normalizeExternalUrl("http://example.com/path")).toBe("http://example.com/path");
  });

  it("normalizes protocol-relative urls", () => {
    expect(normalizeExternalUrl("//example.com/path")).toBe("https://example.com/path");
  });

  it("rejects malformed or unsafe urls", () => {
    expect(normalizeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeExternalUrl("not a url")).toBeNull();
    expect(normalizeExternalUrl("")).toBeNull();
  });
});
