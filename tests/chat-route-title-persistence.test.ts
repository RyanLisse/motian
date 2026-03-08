import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("chat route title persistence", () => {
  it("persists the session before title generation and updates title conditionally", () => {
    const source = readFile("app/api/chat/route.ts");

    const persistIndex = source.indexOf("await persistMessages({");
    const generateIndex = source.indexOf("await generateObject({");

    expect(persistIndex).toBeGreaterThan(-1);
    expect(generateIndex).toBeGreaterThan(-1);
    expect(persistIndex).toBeLessThan(generateIndex);

    expect(source).toContain("after(async () => {");
    expect(source).toContain(".update(chatSessions)");
    expect(source).toContain("isNull(chatSessions.title)");
  });
});
