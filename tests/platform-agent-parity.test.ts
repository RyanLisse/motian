import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("platform workflow parity across surfaces", () => {
  it("exposes the core onboarding verbs in AI, CLI, MCP, voice, and the scraper UI", () => {
    const aiTools = read("src/ai/tools/index.ts");
    const cliCommands = read("src/cli/commands.ts");
    const mcpTools = read("src/mcp/tools/index.ts");
    const mcpPlatformTools = read("src/mcp/tools/platforms.ts");
    const voiceAgent = read("src/voice-agent/agent.ts");
    const scraperPage = read("app/scraper/page.tsx");
    const platformCatalogComponent = read("components/scraper/platform-catalog-list.tsx");

    expect(aiTools).toContain("platformsList");
    expect(aiTools).toContain("platformCatalogCreate");
    expect(aiTools).toContain("platformConfigCreate");
    expect(aiTools).toContain("platformConfigValidate");
    expect(aiTools).toContain("platformTestImport");
    expect(aiTools).toContain("platformOnboardingStatus");

    expect(cliCommands).toContain('"platforms:add"');
    expect(cliCommands).toContain('"platforms:list"');
    expect(cliCommands).toContain('"platforms:configure"');
    expect(cliCommands).toContain('"platforms:validate"');
    expect(cliCommands).toContain('"platforms:test-import"');
    expect(cliCommands).toContain('"platforms:status"');

    expect(mcpTools).toContain("platformsHandlers");
    expect(mcpTools).toContain("platformsTools");
    expect(mcpPlatformTools).toContain("platform_catalog_create");

    expect(voiceAgent).toContain("platformCatalogMaakAan");
    expect(voiceAgent).toContain("platformsLijst");
    expect(voiceAgent).toContain("platformConfigValideren");
    expect(voiceAgent).toContain("platformTestImport");

    expect(scraperPage).toContain("PlatformCatalogList");
    expect(platformCatalogComponent).toContain("PlatformCatalogCreateDrawer");
    expect(platformCatalogComponent).toContain("PlatformOnboardingDrawer");
  });
});
