import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("pipeline feedback workflow", () => {
  it("wires the shared feedback editor into the pipeline surfaces", () => {
    const pageSource = readFile("app/pipeline/page.tsx");
    const cardSource = readFile("components/pipeline/kanban-card.tsx");
    expect(pageSource).toContain("ApplicationFeedbackEditor");
    expect(cardSource).toContain("ApplicationFeedbackEditor");
  });

  it("saves recruiter notes through the sollicitaties patch route", () => {
    const source = readFile("components/pipeline/application-feedback-editor.tsx");
    expect(source).toContain("api/sollicitaties/");
    expect(source).toContain("Recruiterfeedback");
    expect(source).toContain("Feedback opslaan");
  });
});
