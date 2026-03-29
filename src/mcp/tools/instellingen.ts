import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { settingsPayloadSchema } from "../../schemas/settings";
import { getAllSettings, updateSettings } from "../../services/settings";

// ========== Schemas ==========

const leesInstellingenSchema = z.object({});

const updateInstellingenSchema = settingsPayloadSchema
  .partial()
  .describe("Een of meer instellingen om bij te werken");

// ========== Tool Definitions ==========

export const tools = [
  {
    name: "lees_instellingen",
    description:
      "Lees alle systeeminstellingen op (scoring drempel, verrijking, GDPR retentie, meldingen).",
    inputSchema: zodToJsonSchema(leesInstellingenSchema, { $refStrategy: "none" }),
  },
  {
    name: "update_instellingen",
    description:
      "Werk een of meer systeeminstellingen bij. Ondersteunt: minimumScoreThreshold, autoEnrichmentEnabled, gdprRetentionDays, autoCleanupEnabled, slackNotificationsEnabled, notifyOnScrapeErrors.",
    inputSchema: zodToJsonSchema(updateInstellingenSchema, { $refStrategy: "none" }),
  },
];

// ========== Handlers ==========

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  lees_instellingen: async () => {
    return getAllSettings();
  },

  update_instellingen: async (raw) => {
    const data = updateInstellingenSchema.parse(raw);
    return updateSettings(data);
  },
};
