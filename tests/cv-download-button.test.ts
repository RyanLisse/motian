import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("CV download GenUI action", () => {
  it("renders a Download CV button that posts candidateId to the commercial CV HTML endpoint", () => {
    const registrySource = readFile("components/chat/genui/registry.ts");
    const cardSource = readFile("components/chat/genui/cv-intake-card.tsx");

    expect(registrySource).toContain("cvIntakeResultaat");
    expect(cardSource).toContain("Download CV");
    expect(cardSource).toContain("/api/commercieel-cv/html");
    expect(cardSource).toContain('method: "POST"');
    expect(cardSource).toContain("JSON.stringify({ candidateId })");
  });
});
