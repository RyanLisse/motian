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
  });

  it("shows a text-chat fallback when voice mode is unavailable", () => {
    const source = readFile("components", "chat", "voice-session.tsx");

    expect(source).toContain("DEFAULT_VOICE_UNAVAILABLE_MESSAGE");
    expect(source).toContain('role="alert"');
    expect(source).toContain("Verder met tekstchat");
  });
});
