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

    const insertIndex = source.indexOf("await db\n          .insert(chatSessions)");
    const generateIndex = source.indexOf("await generateObject({");

    expect(insertIndex).toBeGreaterThan(-1);
    expect(generateIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeLessThan(generateIndex);

    expect(source).toContain("void (async () => {");
    expect(source).toContain(".update(chatSessions)");
    expect(source).toContain("isNull(chatSessions.title)");
  });
});
