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

    expect(source).toContain("tracedGenerateObject as generateObject");
    expect(source).toContain("after(async () => {");
    expect(source).toContain(".update(chatSessions)");
    expect(source).toContain("isNull(chatSessions.title)");
  });

  it("uses a lightweight session snapshot before persistence without reloading context messages", () => {
    const source = readFile("app/api/chat/route.ts");

    expect(source).toContain("getSessionRequestSnapshot");
    expect(source).toContain(
      "const sessionSnapshot = sessionId ? await loadSessionSnapshotOrFallback(sessionId) : null;",
    );
    expect(source).toContain("const used = sessionSnapshot?.tokensUsed ?? 0;");
    expect(source).toContain("(sessionSnapshot?.messageCount ?? 0) === 0");
    expect(source).not.toContain("getSessionTokenUsage(sessionId)");
    expect(source).not.toContain("getRecentMessagesForContext(sessionId, 1)");
  });
});
