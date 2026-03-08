import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("chat history sidebar title refresh", () => {
  it("retries fetching when the active session still has a placeholder title", () => {
    const source = readFile("components", "chat", "chat-history-sidebar.tsx");

    expect(source).toContain("const TITLE_REFRESH_DELAY_MS = 1200");
    expect(source).toContain("const MAX_TITLE_REFRESH_ATTEMPTS = 3");
    expect(source).toContain(
      "const activeSession = sessions.find((session) => session.sessionId === activeSessionId);",
    );
    expect(source).toContain("!activeSession.title");
    expect(source).toContain("titleRefreshAttemptRef.current < MAX_TITLE_REFRESH_ATTEMPTS");
    expect(source).toContain("void fetchSessions();");
  });
});
