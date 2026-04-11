import { beforeEach, describe, expect, it } from "vitest";
import {
  createCookbookBlock,
  createCookbookMarkdown,
  generateCookbooksFromTools,
  getCookbookByToolName,
  resetCookbookStore,
  suggestCookbookForError,
} from "@/src/services/cookbooks";
import { allTools } from "@/src/mcp/tools";

describe("cookbooks service", () => {
  beforeEach(() => {
    resetCookbookStore();
  });

  it("generates markdown skeleton with required frontmatter fields", () => {
    const tool = allTools[0];
    const markdown = createCookbookMarkdown(tool);

    expect(markdown).toContain("tool_name:");
    expect(markdown).toContain("prerequisites:");
    expect(markdown).toContain("failure_modes:");
    expect(markdown).toContain(`# Cookbook: ${tool.name}`);
  });

  it("creates cookbook blocks tagged by tool name", () => {
    const tool = allTools[0];
    const block = createCookbookBlock(tool);

    expect(block.type).toBe("cookbook");
    expect(block.tags).toContain(tool.name);
    expect(block.toolName).toBe(tool.name);
  });

  it("stores and retrieves cookbook blocks by tool name", () => {
    const generated = generateCookbooksFromTools(allTools.slice(0, 3));
    expect(generated).toHaveLength(3);

    const result = getCookbookByToolName(generated[1].toolName);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("cookbook");
  });

  it("returns a cookbook suggestion for known tools", () => {
    generateCookbooksFromTools(allTools.slice(0, 1));
    const known = allTools[0].name;

    expect(suggestCookbookForError(known)).toContain('cookbook_get met toolName');
    expect(suggestCookbookForError("unknown_tool")).toBeNull();
  });
});
