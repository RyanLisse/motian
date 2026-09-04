import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("whatsapp status caching (trust boundary)", () => {
  it("is dynamic and private — not force-static / publicly cacheable", () => {
    const source = readFileSync(join(process.cwd(), "app/api/whatsapp/status/route.ts"), "utf8");
    expect(source).toContain('dynamic = "force-dynamic"');
    expect(source).toContain("private, no-store");
    expect(source).not.toContain("force-static");
    expect(source).not.toMatch(/public,\s*s-maxage/);
  });
});
