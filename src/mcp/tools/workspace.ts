import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getWorkspaceSummary } from "../../services/workspace";

// ========== Schemas ==========

const werkruimteOverzichtSchema = z.object({});

// ========== Tool Definitions ==========

export const tools = [
  {
    name: "werkruimte_overzicht",
    description:
      "Geeft een volledig overzicht van de werkruimte: vacatures, kandidaten, matches en scraper-gezondheid.",
    inputSchema: zodToJsonSchema(werkruimteOverzichtSchema, { $refStrategy: "none" }),
  },
];

// ========== Handlers ==========

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  werkruimte_overzicht: async () => {
    const summary = await getWorkspaceSummary();
    return summary;
  },
};
