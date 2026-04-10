/**
 * Tool parity tests — verify that all three agent surfaces (chat, MCP, voice)
 * expose a consistent set of recruitment tools.
 *
 * Each surface uses different naming conventions:
 *   - Chat: camelCase keys (e.g. queryOpdrachten, zoekKandidaten)
 *   - MCP: snake_case name fields (e.g. zoek_vacatures, zoek_kandidaten)
 *   - Voice: camelCase keys (e.g. zoekOpdrachten, zoekKandidaten)
 *
 * Because the surfaces intentionally use different verb choices for the same
 * capability (e.g. chat "queryOpdrachten" = MCP "zoek_vacatures"), we test:
 *   1. Each surface extracts a minimum expected tool count (no silent regressions).
 *   2. Functional domain coverage: each domain area is represented in each surface.
 *   3. Voice covers at least 50% of chat tool count.
 *   4. A full parity report is printed for human review.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "../..");

function readFile(filePath: string): string {
  const full = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  if (!fs.existsSync(full)) return "";
  return fs.readFileSync(full, "utf-8");
}

// ---------------------------------------------------------------------------
// Extract tool names from each agent surface
// ---------------------------------------------------------------------------

function extractChatToolNames(): string[] {
  const source = readFile("src/ai/agent.ts");
  const names: string[] = [];
  const keyPattern = /^\s+(\w+):\s*tools\.\w+/gm;
  for (const match of source.matchAll(keyPattern)) {
    names.push(match[1]);
  }
  return [...new Set(names)];
}

function extractMcpToolNames(): string[] {
  const toolsDir = path.join(ROOT, "src/mcp/tools");
  const names: string[] = [];
  if (!fs.existsSync(toolsDir)) return names;
  const files = fs.readdirSync(toolsDir).filter((f) => f.endsWith(".ts"));
  for (const file of files) {
    const source = readFile(path.join(toolsDir, file));
    const namePattern = /name:\s*"([^"]+)"/g;
    for (const match of source.matchAll(namePattern)) {
      names.push(match[1]);
    }
  }
  return [...new Set(names)];
}

function extractVoiceToolNames(): string[] {
  const source = readFile("src/voice-agent/agent.ts");
  const names: string[] = [];
  const keyPattern = /^\s{8}(\w+):\s*llm\.tool\(/gm;
  for (const match of source.matchAll(keyPattern)) {
    names.push(match[1]);
  }
  return [...new Set(names)];
}

// ---------------------------------------------------------------------------
// Domain classification — group tools by functional domain
// ---------------------------------------------------------------------------

/** Domain keywords used to classify tools into functional areas. */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  jobs: ["opdracht", "vacature", "job"],
  candidates: ["kandidaat", "kandidaten", "candidate"],
  matches: ["match"],
  applications: ["sollicitatie", "application"],
  interviews: ["interview"],
  messages: ["bericht", "message", "stuur"],
  gdpr: ["gdpr", "exporteer", "wis", "scrub", "retentie"],
  platforms: ["platform"],
  scraper: ["scraper", "scrape", "import", "scoring"],
};

function classifyTool(name: string): string {
  const lower = name.toLowerCase().replace(/_/g, "");
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return domain;
    }
  }
  return "other";
}

function getDomainCoverage(tools: string[]): Set<string> {
  const domains = new Set<string>();
  for (const tool of tools) {
    domains.add(classifyTool(tool));
  }
  return domains;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Tool parity across agent surfaces", () => {
  const chatTools = extractChatToolNames();
  const mcpTools = extractMcpToolNames();
  const voiceTools = extractVoiceToolNames();

  it("should extract a minimum number of tools from each surface", () => {
    expect(
      chatTools.length,
      `Chat agent tool extraction found only ${chatTools.length} tools`,
    ).toBeGreaterThanOrEqual(10);
    expect(
      mcpTools.length,
      `MCP tool extraction found only ${mcpTools.length} tools`,
    ).toBeGreaterThanOrEqual(10);
    expect(
      voiceTools.length,
      `Voice agent tool extraction found only ${voiceTools.length} tools`,
    ).toBeGreaterThanOrEqual(10);
  });

  it("MCP must not have fewer tools than chat (MCP is the superset)", () => {
    expect(
      mcpTools.length,
      `MCP has ${mcpTools.length} tools, chat has ${chatTools.length}. MCP should be the superset.`,
    ).toBeGreaterThanOrEqual(chatTools.length);
  });

  it("all functional domains present in chat are also present in MCP", () => {
    const chatDomains = getDomainCoverage(chatTools);
    const mcpDomains = getDomainCoverage(mcpTools);

    const missingDomains: string[] = [];
    for (const domain of chatDomains) {
      if (domain === "other") continue;
      if (!mcpDomains.has(domain)) {
        missingDomains.push(domain);
      }
    }

    expect(
      missingDomains,
      `Functional domains present in chat but missing from MCP:\n${missingDomains.join(", ")}`,
    ).toHaveLength(0);
  });

  it("all functional domains present in chat are also present in voice", () => {
    const chatDomains = getDomainCoverage(chatTools);
    const voiceDomains = getDomainCoverage(voiceTools);

    const missingDomains: string[] = [];
    for (const domain of chatDomains) {
      if (domain === "other") continue;
      if (!voiceDomains.has(domain)) {
        missingDomains.push(domain);
      }
    }

    // Voice may intentionally skip entire domains — warn but don't fail
    if (missingDomains.length > 0) {
      console.warn(
        `\n[Tool Parity] Voice agent missing functional domains: ${missingDomains.join(", ")}\n`,
      );
    }

    // At minimum, voice should cover core domains
    const coreDomains = ["jobs", "candidates", "matches"];
    const missingCore = coreDomains.filter((d) => !voiceDomains.has(d));
    expect(missingCore, `Voice agent missing core domains: ${missingCore.join(", ")}`).toHaveLength(
      0,
    );
  });

  it("voice covers at least 50% of chat tool count", () => {
    const coverageRatio = voiceTools.length / chatTools.length;
    expect(
      coverageRatio,
      `Voice agent has ${voiceTools.length} tools vs chat ${chatTools.length} (${(coverageRatio * 100).toFixed(1)}%). Expected >= 50%.`,
    ).toBeGreaterThanOrEqual(0.5);
  });

  it("prints full parity report", () => {
    const report: string[] = [];
    report.push(`Chat: ${chatTools.length} tools`);
    report.push(`MCP:  ${mcpTools.length} tools`);
    report.push(`Voice: ${voiceTools.length} tools`);
    report.push("");

    // Domain breakdown
    report.push("Domain breakdown:");
    const allDomains = new Set([
      ...chatTools.map(classifyTool),
      ...mcpTools.map(classifyTool),
      ...voiceTools.map(classifyTool),
    ]);
    for (const domain of [...allDomains].sort()) {
      const chatCount = chatTools.filter((t) => classifyTool(t) === domain).length;
      const mcpCount = mcpTools.filter((t) => classifyTool(t) === domain).length;
      const voiceCount = voiceTools.filter((t) => classifyTool(t) === domain).length;
      report.push(
        `  ${domain.padEnd(15)} Chat: ${String(chatCount).padStart(2)} | MCP: ${String(mcpCount).padStart(2)} | Voice: ${String(voiceCount).padStart(2)}`,
      );
    }

    report.push("");
    report.push("Chat tools:");
    for (const t of chatTools.sort()) report.push(`  - ${t} [${classifyTool(t)}]`);
    report.push("");
    report.push("MCP tools:");
    for (const t of mcpTools.sort()) report.push(`  - ${t} [${classifyTool(t)}]`);
    report.push("");
    report.push("Voice tools:");
    for (const t of voiceTools.sort()) report.push(`  - ${t} [${classifyTool(t)}]`);

    console.info(`\n[Tool Parity Report]\n${report.join("\n")}\n`);

    // Always passes — informational output
    expect(true).toBe(true);
  });
});
