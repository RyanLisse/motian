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
    const aiAgentPath = join(process.cwd(), "src/ai/agent.ts");

    expect(existsSync(onboardingSkillPath)).toBe(true);
    expect(existsSync(triageSkillPath)).toBe(true);
    expect(existsSync(runbookPath)).toBe(true);
    expect(existsSync(aiAgentPath)).toBe(true);

    const onboardingSkill = read(".codex/skills/platform-onboarding/SKILL.md");
    const triageSkill = read(".codex/skills/public-board-triage/SKILL.md");
    const runbook = read("docs/runbooks/platform-onboarding.md");
    const aiAgent = read("src/ai/agent.ts");

    expect(onboardingSkill).toContain("platformsList");
    expect(onboardingSkill).toContain("platformConfigCreate");
    expect(onboardingSkill).toContain("platformConfigValidate");
    expect(onboardingSkill).toContain("platformTestImport");
    expect(onboardingSkill).toContain("platformActivate");
    expect(onboardingSkill).toContain("waiting_for_credentials");
    expect(onboardingSkill).toContain("implement_adapter");
    expect(onboardingSkill).toContain("verify_schedule");

    expect(triageSkill).toContain("needs_implementation");
    expect(triageSkill).toContain("blocker");
    expect(triageSkill).toContain("evidence");

    expect(runbook).toContain("/api/platforms");
    expect(runbook).toContain("/api/platforms/[slug]/validate");
    expect(runbook).toContain("/api/platforms/[slug]/test-import");
    expect(runbook).toContain("platforms:list");
    expect(runbook).toContain("platform_test_import");
    expect(runbook).toContain("waiting_for_credentials");
    expect(runbook).toContain("first successful scrape");
    expect(runbook).not.toContain("stop with `needs_implementation`");

    expect(aiAgent).toContain("credentials");
    expect(aiAgent).toContain("implementatie");
    expect(aiAgent).toContain("monitoring");
  });

  it("exposes a recruiter add-platform affordance and registry-backed seed flow", () => {
    const catalogList = read("components/scraper/platform-catalog-list.tsx");
    const configForm = read("components/scraper/platform-config-form.tsx");
    const seedScript = read("scripts/seed-new-platforms.ts");

    expect(catalogList).toContain("Nieuw platform");
    expect(seedScript).toContain("platformCatalog");
    expect(seedScript).toContain("listPlatformDefinitions");
    expect(configForm).toContain("Volgende stap");
    expect(configForm).toContain("Aanbevolen acties");
  });
});
