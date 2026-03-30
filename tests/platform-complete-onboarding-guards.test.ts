import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("platform complete onboarding guards", () => {
  it("guards the AI tool with the latest onboarding status before completion", () => {
    const file = read("src/ai/tools/platform-dynamic.ts");

    expect(file).toContain("getPlatformOnboardingStatus");
    expect(file).toContain('latestRunStatus !== "active"');
    expect(file).toContain("kan onboarding niet voltooien vanuit status");
  });

  it("guards the MCP tool with the latest onboarding status before completion", () => {
    const file = read("src/mcp/tools/platforms.ts");

    expect(file).toContain("getPlatformOnboardingStatus");
    expect(file).toContain('latestRunStatus !== "active"');
    expect(file).toContain("kan onboarding niet voltooien vanuit status");
  });
});
