import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { publish } from "../../lib/event-bus.js";
import { jsonObjectSchema } from "../../lib/json-value-schema.js";
import {
  activatePlatform,
  createConfig,
  createPlatformCatalogEntry,
  getPlatformOnboardingStatus,
  listPlatformCatalog,
  triggerTestRun,
  validateConfig,
} from "../../services/scrapers.js";

const platformSchema = z.object({
  platform: z.string().min(1).describe("Platform slug"),
});

const platformConfigSchema = z.object({
  platform: z.string().min(1).describe("Platform slug"),
  baseUrl: z.string().url().optional().describe("Base URL voor de bron"),
  cronExpression: z.string().optional().describe("Cron expressie"),
  credentialsRef: z.string().optional().describe("Externe secret/credential referentie"),
  isActive: z.boolean().optional().describe("Activeer direct na opslaan"),
  parameters: jsonObjectSchema.optional().describe("JSON parameters object"),
  authConfig: jsonObjectSchema.optional().describe("JSON auth object"),
});

const platformCatalogSchema = z.object({
  slug: z.string().min(1).describe("Platform slug"),
  displayName: z.string().optional().describe("Leesbare naam"),
  adapterKind: z.string().optional().describe("Adapter kind"),
  authMode: z.string().optional().describe("Authenticatie modus"),
  defaultBaseUrl: z.string().url().optional().describe("Default base URL"),
  docsUrl: z.string().url().optional().describe("Documentatie URL"),
  description: z.string().optional().describe("Omschrijving"),
});

export const tools = [
  {
    name: "platforms_list",
    description: "Lijst alle platform catalogus entries en onboarding status.",
    inputSchema: zodToJsonSchema(z.object({}), { $refStrategy: "none" }),
  },
  {
    name: "platform_catalog_create",
    description: "Maak of seed een platform catalogus entry.",
    inputSchema: zodToJsonSchema(platformCatalogSchema, { $refStrategy: "none" }),
  },
  {
    name: "platform_config_create",
    description: "Maak of overschrijf een platform runtime config.",
    inputSchema: zodToJsonSchema(platformConfigSchema, { $refStrategy: "none" }),
  },
  {
    name: "platform_config_validate",
    description: "Valideer de opgeslagen configuratie voor een platform.",
    inputSchema: zodToJsonSchema(platformSchema, { $refStrategy: "none" }),
  },
  {
    name: "platform_test_import",
    description: "Draai een smoke import voor een platform.",
    inputSchema: zodToJsonSchema(
      platformSchema.extend({
        limit: z.number().int().min(1).max(10).optional().describe("Max listings"),
      }),
      { $refStrategy: "none" },
    ),
  },
  {
    name: "platform_activate",
    description: "Activeer een platform na onboarding.",
    inputSchema: zodToJsonSchema(platformSchema, { $refStrategy: "none" }),
  },
  {
    name: "platform_onboarding_status",
    description: "Toon config, catalogus en laatste onboarding status voor een platform.",
    inputSchema: zodToJsonSchema(platformSchema, { $refStrategy: "none" }),
  },
];

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  platforms_list: async () => listPlatformCatalog(),
  platform_catalog_create: async (raw) => {
    const data = platformCatalogSchema.parse(raw);
    const result = await createPlatformCatalogEntry({ ...data, source: "mcp" });
    try {
      revalidatePath("/databronnen");
    } catch {
      /* MCP runs outside request context */
    }
    publish("platform:updated", { slug: data.slug });
    return result;
  },
  platform_config_create: async (raw) => {
    const data = platformConfigSchema.parse(raw);
    const result = await createConfig({ ...data, source: "mcp" });
    try {
      revalidatePath("/databronnen");
    } catch {
      /* MCP runs outside request context */
    }
    publish("platform:configured", { platform: data.platform });
    return result;
  },
  platform_config_validate: async (raw) => {
    const { platform } = platformSchema.parse(raw);
    return validateConfig(platform, "mcp");
  },
  platform_test_import: async (raw) => {
    const { platform, limit } = platformSchema
      .extend({
        limit: z.number().int().min(1).max(10).optional(),
      })
      .parse(raw);
    return triggerTestRun(platform, "mcp", limit ?? 3);
  },
  platform_activate: async (raw) => {
    const { platform } = platformSchema.parse(raw);
    const result = await activatePlatform(platform, "mcp");
    try {
      revalidatePath("/databronnen");
    } catch {
      /* MCP runs outside request context */
    }
    publish("platform:activated", { platform });
    return result;
  },
  platform_onboarding_status: async (raw) => {
    const { platform } = platformSchema.parse(raw);
    return getPlatformOnboardingStatus(platform);
  },
};
