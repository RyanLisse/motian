import { describe, it, expect } from "vitest";

// ===== Phase 8: CLI Command Structure =====

describe("CLI candidates command", () => {
  it("exports registerCandidatesCommand", async () => {
    const mod = await import("../cli/commands/candidates.js");
    expect(typeof mod.registerCandidatesCommand).toBe("function");
  });

  it("registers on a Commander program", async () => {
    const { Command } = await import("commander");
    const { registerCandidatesCommand } = await import("../cli/commands/candidates.js");
    const program = new Command();
    registerCandidatesCommand(program);
    const candidatesCmd = program.commands.find((c) => c.name() === "candidates");
    expect(candidatesCmd).toBeDefined();
  });

  it("has list, show, search, add, stats subcommands", async () => {
    const { Command } = await import("commander");
    const { registerCandidatesCommand } = await import("../cli/commands/candidates.js");
    const program = new Command();
    registerCandidatesCommand(program);
    const candidatesCmd = program.commands.find((c) => c.name() === "candidates")!;
    const subNames = candidatesCmd.commands.map((c) => c.name());
    expect(subNames).toContain("list");
    expect(subNames).toContain("show");
    expect(subNames).toContain("search");
    expect(subNames).toContain("add");
    expect(subNames).toContain("stats");
  });
});

describe("CLI matches command", () => {
  it("exports registerMatchesCommand", async () => {
    const mod = await import("../cli/commands/matches.js");
    expect(typeof mod.registerMatchesCommand).toBe("function");
  });

  it("registers on a Commander program", async () => {
    const { Command } = await import("commander");
    const { registerMatchesCommand } = await import("../cli/commands/matches.js");
    const program = new Command();
    registerMatchesCommand(program);
    const matchesCmd = program.commands.find((c) => c.name() === "matches");
    expect(matchesCmd).toBeDefined();
  });

  it("has list, show, approve, reject, stats subcommands", async () => {
    const { Command } = await import("commander");
    const { registerMatchesCommand } = await import("../cli/commands/matches.js");
    const program = new Command();
    registerMatchesCommand(program);
    const matchesCmd = program.commands.find((c) => c.name() === "matches")!;
    const subNames = matchesCmd.commands.map((c) => c.name());
    expect(subNames).toContain("list");
    expect(subNames).toContain("show");
    expect(subNames).toContain("approve");
    expect(subNames).toContain("reject");
    expect(subNames).toContain("stats");
  });
});

describe("CLI index registers all commands", () => {
  it("registers jobs, scrapers, candidates, matches", async () => {
    // The CLI index imports and calls all register functions.
    // We verify the imports resolve correctly.
    const jobsMod = await import("../cli/commands/jobs.js");
    const scrapersMod = await import("../cli/commands/scrapers.js");
    const candidatesMod = await import("../cli/commands/candidates.js");
    const matchesMod = await import("../cli/commands/matches.js");

    expect(typeof jobsMod.registerJobsCommand).toBe("function");
    expect(typeof scrapersMod.registerScraperCommand).toBe("function");
    expect(typeof candidatesMod.registerCandidatesCommand).toBe("function");
    expect(typeof matchesMod.registerMatchesCommand).toBe("function");
  });
});

// ===== Phase 8: MCP Server Tool Definitions =====

describe("MCP server module", () => {
  it("server.ts exists and is importable as a module", async () => {
    // Verify the file can be statically analyzed
    const fs = await import("node:fs");
    const path = await import("node:path");
    const serverPath = path.resolve("src/mcp/server.ts");
    const exists = fs.existsSync(serverPath);
    expect(exists).toBe(true);
  });

  it("server.ts defines all 14 required tools", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const serverPath = path.resolve("src/mcp/server.ts");
    const content = fs.readFileSync(serverPath, "utf-8");

    const requiredTools = [
      "list_jobs",
      "get_job",
      "search_jobs",
      "list_scrapers",
      "scraper_health",
      "toggle_scraper",
      "list_candidates",
      "get_candidate",
      "search_candidates",
      "create_candidate",
      "list_matches",
      "get_match",
      "approve_match",
      "reject_match",
    ];

    for (const tool of requiredTools) {
      expect(content).toContain(`"${tool}"`);
    }
  });

  it("server.ts imports from shared service layer", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const serverPath = path.resolve("src/mcp/server.ts");
    const content = fs.readFileSync(serverPath, "utf-8");

    expect(content).toContain("services/candidates");
    expect(content).toContain("services/matches");
    expect(content).toContain("services/scrapers");
    expect(content).toContain("services/jobs");
  });

  it("server.ts uses stdio transport", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const serverPath = path.resolve("src/mcp/server.ts");
    const content = fs.readFileSync(serverPath, "utf-8");

    expect(content).toContain("StdioServerTransport");
  });
});

// ===== Phase 8: AGENT_PROMPT.md =====

describe("AGENT_PROMPT.md", () => {
  it("exists", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const promptPath = path.resolve("AGENT_PROMPT.md");
    expect(fs.existsSync(promptPath)).toBe(true);
  });

  it("documents all 23 MCP tools", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const promptPath = path.resolve("AGENT_PROMPT.md");
    const content = fs.readFileSync(promptPath, "utf-8");

    const toolNames = [
      "list_jobs",
      "get_job",
      "search_jobs",
      "list_scrapers",
      "scraper_health",
      "toggle_scraper",
      "list_candidates",
      "get_candidate",
      "search_candidates",
      "create_candidate",
      "list_matches",
      "get_match",
      "approve_match",
      "reject_match",
      "list_applications",
      "create_application",
      "update_application_stage",
      "list_interviews",
      "create_interview",
      "update_interview",
      "list_messages",
      "get_message",
      "create_message",
    ];

    for (const tool of toolNames) {
      expect(content).toContain(tool);
    }
  });

  it("includes example workflows", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const promptPath = path.resolve("AGENT_PROMPT.md");
    const content = fs.readFileSync(promptPath, "utf-8").toLowerCase();

    // Should have workflow examples
    expect(content).toContain("voorbeeld");
  });
});

// ===== Phase 8: Parity Audit =====

describe("CLI-MCP parity", () => {
  it("CLI and MCP both cover candidates operations", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const cliContent = fs.readFileSync(path.resolve("cli/commands/candidates.ts"), "utf-8");
    const mcpContent = fs.readFileSync(path.resolve("src/mcp/server.ts"), "utf-8");

    // Both should have list, get/show, search, create/add operations
    expect(cliContent).toContain("listCandidates");
    expect(mcpContent).toContain("listCandidates");

    expect(cliContent).toContain("getCandidateById");
    expect(mcpContent).toContain("getCandidateById");

    expect(cliContent).toContain("searchCandidates");
    expect(mcpContent).toContain("searchCandidates");

    expect(cliContent).toContain("createCandidate");
    expect(mcpContent).toContain("createCandidate");
  });

  it("CLI and MCP both cover matches operations", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const cliContent = fs.readFileSync(path.resolve("cli/commands/matches.ts"), "utf-8");
    const mcpContent = fs.readFileSync(path.resolve("src/mcp/server.ts"), "utf-8");

    expect(cliContent).toContain("listMatches");
    expect(mcpContent).toContain("listMatches");

    expect(cliContent).toContain("getMatchById");
    expect(mcpContent).toContain("getMatchById");

    expect(cliContent).toContain("updateMatchStatus");
    expect(mcpContent).toContain("updateMatchStatus");
  });
});
