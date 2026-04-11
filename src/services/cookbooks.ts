import type { allTools } from "../mcp/tools";

type McpToolDefinition = (typeof allTools)[number];

export type CookbookBlock = {
  type: "cookbook";
  tags: string[];
  toolName: string;
  markdown: string;
  createdAt: string;
  updatedAt: string;
};

const cookbookStore = new Map<string, CookbookBlock>();

function normalizeToolName(toolName: string): string {
  return toolName.trim().toLowerCase();
}

function deriveFailureModes(tool: McpToolDefinition): string[] {
  return [
    `Schema-validatie mislukt voor tool ${tool.name}`,
    `Upstream service-fout in handler van ${tool.name}`,
    `Ontbrekende of ongeldige argumenten voor ${tool.name}`,
  ];
}

export function createCookbookMarkdown(tool: McpToolDefinition): string {
  const failureModes = deriveFailureModes(tool)
    .map((mode) => `  - "${mode}"`)
    .join("\n");

  return `---
tool_name: "${tool.name}"
prerequisites:
  - "Bevestig vereiste velden tegen inputSchema"
  - "Controleer authenticatie en omgevingsvariabelen"
failure_modes:
${failureModes}
---

# Cookbook: ${tool.name}

## Doel
${tool.description}

## Procedure
1. Controleer de verwachte input tegen de schema-eisen.
2. Voer de tool uit met minimale geldige argumenten.
3. Verifieer outputvorm en domeinvalidatie.
4. Schaal op met volledige payload en controleer randgevallen.

## Troubleshooting
- Bekijk de exacte foutmelding en map die naar een failure mode.
- Valideer argumentnamen en types opnieuw.
- Probeer de tool opnieuw met een minimale payload om de fout te isoleren.
`;
}

export function createCookbookBlock(tool: McpToolDefinition): CookbookBlock {
  const timestamp = new Date().toISOString();
  return {
    type: "cookbook",
    tags: [tool.name],
    toolName: tool.name,
    markdown: createCookbookMarkdown(tool),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function upsertCookbook(block: CookbookBlock): CookbookBlock {
  const key = normalizeToolName(block.toolName);
  const existing = cookbookStore.get(key);
  const next: CookbookBlock = {
    ...block,
    createdAt: existing?.createdAt ?? block.createdAt,
    updatedAt: new Date().toISOString(),
  };
  cookbookStore.set(key, next);
  return next;
}

export function getCookbookByToolName(toolName: string): CookbookBlock | null {
  return cookbookStore.get(normalizeToolName(toolName)) ?? null;
}

export function suggestCookbookForError(toolName: string): string | null {
  const cookbook = getCookbookByToolName(toolName);
  if (!cookbook) return null;
  return `Tip: gebruik cookbook_get met toolName=\"${cookbook.toolName}\" voor stapsgewijze troubleshooting.`;
}

export function generateCookbooksFromTools(tools: McpToolDefinition[]): CookbookBlock[] {
  return tools.map((tool) => upsertCookbook(createCookbookBlock(tool)));
}

export function resetCookbookStore(): void {
  cookbookStore.clear();
}
