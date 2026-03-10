import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("voice session graceful fallback", () => {
  it("checks voice availability before starting a LiveKit session", () => {
    const source = readFile("components", "chat", "voice-session.tsx");

    expect(source).toContain('fetch("/api/livekit-token", {');
    expect(source).toContain('method: "GET"');
    expect(source).toContain('cache: "no-store"');
    expect(source).toContain("signal: controller.signal");
    expect(source).toContain("window.setTimeout(() => controller.abort(), 5000)");
  });

  it("shows a text-chat fallback with client-owned Dutch copy when voice mode is unavailable", () => {
    const source = readFile("components", "chat", "voice-session.tsx");

    expect(source).toContain("const VOICE_UNAVAILABLE_MESSAGES");
    expect(source).toContain(
      "VOICE_UNAVAILABLE_MESSAGES[error] ?? DEFAULT_VOICE_UNAVAILABLE_MESSAGE",
    );
    expect(source).toContain('role="alert"');
    expect(source).toContain("Verder met tekstchat");
  });
});
