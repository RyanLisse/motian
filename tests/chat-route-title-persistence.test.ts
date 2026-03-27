import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

/** Read all chat route module source (route.ts + _helpers.ts) for contract checks. */
function readChatModule(): string {
  return [readFile("app/api/chat/route.ts"), readFile("app/api/chat/_helpers.ts")].join("\n");
}

describe("chat route title persistence", () => {
  it("persists the session before title generation and updates title conditionally", () => {
    const route = readFile("app/api/chat/route.ts");
    const helpers = readFile("app/api/chat/_helpers.ts");
    const source = readChatModule();

    // persistMessages must come before generateSessionTitle in the route handler
    const persistIndex = route.indexOf("await persistMessages({");
    const titleIndex = route.indexOf("generateSessionTitle(");

    expect(persistIndex).toBeGreaterThan(-1);
    expect(titleIndex).toBeGreaterThan(-1);
    expect(persistIndex).toBeLessThan(titleIndex);

    // Title generation uses generateObject in the helpers module
    expect(helpers).toContain("tracedGenerateObject as generateObject");
    expect(route).toContain("after(");
    expect(helpers).toContain(".update(chatSessions)");
    expect(helpers).toContain("isNull(chatSessions.title)");
  });

  it("uses a lightweight session snapshot before persistence without reloading context messages", () => {
    const source = readChatModule();
    const route = readFile("app/api/chat/route.ts");

    expect(route).toContain("getSessionRequestSnapshot");
    expect(route).toContain(
      "const sessionSnapshot = sessionId ? await loadSessionSnapshotOrFallback(sessionId) : null;",
    );
    // Token budget check uses snapshot parameter in helper
    expect(source).toContain("snapshot?.tokensUsed");
    expect(source).toContain("(sessionSnapshot?.messageCount ?? 0) === 0");
    expect(source).not.toContain("getSessionTokenUsage(sessionId)");
  });

  it("fails closed when snapshot load fails, blocking budget bypass and title generation", () => {
    const source = readChatModule();

    expect(source).toContain("loadFailed");
    expect(source).toContain("sessionSnapshot?.loadFailed");
    expect(source).toContain("!sessionSnapshot?.loadFailed");
  });

  it("skips reloading and assistant persistence when user message write failed", () => {
    const source = readChatModule();

    expect(source).toContain("userMessagesPersisted");
    expect(source).toContain("sessionId && userMessagesPersisted");
    expect(source).toContain("!userMessagesPersisted");
  });
});
