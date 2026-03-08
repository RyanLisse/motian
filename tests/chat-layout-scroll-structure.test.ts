import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("chat layout scroll structure", () => {
  it("bounds the full-page chat shell within the sidebar layout", () => {
    const page = readFile("app", "chat", "page.tsx");
    const source = readFile("components", "chat", "chat-page-content.tsx");

    expect(page).toContain(
      'className="flex h-[calc(100dvh-3rem)] min-h-0 flex-col overflow-hidden"',
    );
    expect(source).toContain(
      'className="relative flex min-h-0 flex-1 overflow-hidden bg-background"',
    );
    expect(page).not.toContain("--sidebar-height");
    expect(source).not.toContain("--sidebar-height");
  });

  it("keeps the conversation pane on a continuous flex/min-h-0 chain", () => {
    const source = readFile("components", "chat", "chat-page-content.tsx");

    expect(source).toContain(
      'className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background"',
    );
    expect(source).toContain('className="flex min-h-0 flex-1 flex-col"');
    expect(source).toContain("<ChatMessages");
  });
});
