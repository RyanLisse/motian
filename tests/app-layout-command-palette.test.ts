import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("app layout command palette wiring", () => {
  it("wires route-level shell overlays from the server layout", () => {
    const source = readFile("app", "layout.tsx");

    expect(source).toContain(
      'import { RouteShellOverlays } from "@/components/route-shell-overlays"',
    );
    expect(source).toContain("<RouteShellOverlays");
  });

  it("keeps shared providers lightweight without globally mounting the WebMCP client provider", () => {
    const source = readFile("app", "providers.tsx");

    expect(source).not.toContain("MotianWebMcpProvider");
  });
});
