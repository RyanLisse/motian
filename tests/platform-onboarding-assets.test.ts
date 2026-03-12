import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("platform onboarding assets", () => {
  it("ships repeatable skills and a runbook for the shared onboarding workflow", () => {
    const onboardingSkillPath = join(process.cwd(), ".codex/skills/platform-onboarding/SKILL.md");
    const triageSkillPath = join(process.cwd(), ".codex/skills/public-board-triage/SKILL.md");
    const runbookPath = join(process.cwd(), "docs/runbooks/platform-onboarding.md");

    expect(existsSync(onboardingSkillPath)).toBe(true);
    expect(existsSync(triageSkillPath)).toBe(true);
    expect(existsSync(runbookPath)).toBe(true);

    const onboardingSkill = read(".codex/skills/platform-onboarding/SKILL.md");
    const triageSkill = read(".codex/skills/public-board-triage/SKILL.md");
    const runbook = read("docs/runbooks/platform-onboarding.md");

    expect(onboardingSkill).toContain("platformsList");
    expect(onboardingSkill).toContain("platformConfigCreate");
    expect(onboardingSkill).toContain("platformConfigValidate");
    expect(onboardingSkill).toContain("platformTestImport");
    expect(onboardingSkill).toContain("platformActivate");

    expect(triageSkill).toContain("needs_implementation");
    expect(triageSkill).toContain("blocker");
    expect(triageSkill).toContain("evidence");

    expect(runbook).toContain("/api/platforms");
    expect(runbook).toContain("/api/platforms/[slug]/validate");
    expect(runbook).toContain("/api/platforms/[slug]/test-import");
    expect(runbook).toContain("platforms:list");
    expect(runbook).toContain("platform_test_import");
  });

  it("exposes a recruiter add-platform affordance and registry-backed seed flow", () => {
    const catalogList = read("components/scraper/platform-catalog-list.tsx");
    const seedScript = read("scripts/seed-new-platforms.ts");

    expect(catalogList).toContain("Nieuw platform");
    expect(seedScript).toContain("platformCatalog");
    expect(seedScript).toContain("listPlatformDefinitions");
  });
});
