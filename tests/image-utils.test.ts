import { describe, expect, it } from "vitest";
import { isSvgImageUrl, normalizeRemoteImageUrl } from "@/src/lib/image-utils";

describe("image-utils", () => {
  it("normalizes absolute and protocol-relative remote URLs", () => {
    expect(normalizeRemoteImageUrl("https://cdn.example.com/logo.png")).toBe(
      "https://cdn.example.com/logo.png",
    );
    expect(normalizeRemoteImageUrl("//cdn.example.com/logo.png")).toBe(
      "https://cdn.example.com/logo.png",
    );
  });

  it("rejects non-http urls and relative paths", () => {
    expect(normalizeRemoteImageUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeRemoteImageUrl("/assets/logo.png")).toBeNull();
    expect(normalizeRemoteImageUrl("")).toBeNull();
  });

  it("detects remote svg images", () => {
    expect(isSvgImageUrl("https://cdn.example.com/logo.svg")).toBe(true);
    expect(isSvgImageUrl("https://cdn.example.com/logo.png")).toBe(false);
  });
});
