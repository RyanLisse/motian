import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getCookbookByToolName } from "../../services/cookbooks";

const cookbookGetSchema = z.object({
  toolName: z.string().min(1).describe("Naam van de MCP tool"),
});

export const tools = [
  {
    name: "cookbook_get",
    description:
      "Haal de procedural cookbook op voor een MCP toolnaam (frontmatter + stapsgewijze procedure).",
    inputSchema: zodToJsonSchema(cookbookGetSchema, { $refStrategy: "none" }),
  },
];

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  cookbook_get: async (raw) => {
    const { toolName } = cookbookGetSchema.parse(raw);
    const cookbook = getCookbookByToolName(toolName);
    if (!cookbook) {
      return {
        found: false,
        toolName,
        message: `Geen cookbook gevonden voor tool ${toolName}`,
      };
    }

    return {
      found: true,
      cookbook,
    };
  },
};
