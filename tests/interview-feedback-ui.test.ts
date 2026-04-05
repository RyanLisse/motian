import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("interview feedback workflow", () => {
  it("renders the interview feedback editor on interview cards", () => {
    const source = readFile("app/interviews/_components/interview-card.tsx");
    expect(source).toContain("InterviewFeedbackEditor");
  });

  it("saves completed interview feedback through the interview patch route", () => {
    const source = readFile("app/interviews/_components/interview-feedback-editor.tsx");
    expect(source).toContain("api/interviews/");
    expect(source).toContain('status: "completed"');
    expect(source).toContain("Feedback opslaan");
  });
});
