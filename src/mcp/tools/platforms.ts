import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { publish } from "../../lib/event-bus";
import { jsonObjectSchema } from "../../lib/json-value-schema";
import {
  activatePlatform,
  completeOnboarding,
  createConfig,
  createPlatformCatalogEntry,
  getPlatformOnboardingStatus,
  listPlatformCatalog,
  runPlatformOnboardingWorkflow,
  triggerTestRun,
  validateConfig,
} from "../../services/scrapers";

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
  {
    name: "platform_auto_setup",
    description:
      "Richt een nieuw platform volledig automatisch in op basis van een URL. Voert analyse, catalogus-aanmaak, configuratie, validatie, test-import en activatie uit.",
    inputSchema: zodToJsonSchema(
      z.object({
        url: z.string().url().describe("Platform URL"),
        activate: z.boolean().optional().describe("Automatisch activeren (standaard: ja)"),
        credentials: z.record(z.string()).optional().describe("Login-gegevens indien nodig"),
      }),
      { $refStrategy: "none" },
    ),
  },
  {
    name: "platform_config_update",
    description: "Werk een bestaande platform runtime config bij.",
    inputSchema: zodToJsonSchema(
      platformConfigSchema.extend({
        id: z.number().optional().describe("Config ID (optioneel, anders lookup op platform slug)"),
      }),
      { $refStrategy: "none" },
    ),
  },
  {
    name: "platform_complete_onboarding",
    description: "Markeer een platform onboarding als voltooid.",
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
  platform_auto_setup: async (raw) => {
    const data = z
      .object({
        url: z.string().url(),
        activate: z.boolean().optional(),
        credentials: z.record(z.string()).optional(),
      })
      .parse(raw);

    const { analyzePlatform } = await import("../../services/platform-analyzer");
    const { validateExternalUrl } = await import("../../services/scrapers");

    // SSRF protection — validate URL before any external fetch
    await validateExternalUrl(data.url);

    const analysis = await analyzePlatform(data.url);
    await createPlatformCatalogEntry({ ...analysis, source: "mcp" });
    const result = await runPlatformOnboardingWorkflow({
      source: "mcp",
      config: {
        platform: analysis.slug,
        baseUrl: analysis.defaultBaseUrl,
        parameters: {
          scrapingStrategy: analysis.scrapingStrategy,
          maxPages: analysis.scrapingStrategy.maxPages,
        },
        ...(data.credentials ? { authConfig: data.credentials } : {}),
        source: "mcp",
      },
      activate: data.activate ?? true,
    });
    publish("platform:activated", { platform: analysis.slug });
    return { success: true, platform: analysis.slug, ...result };
  },
  platform_config_update: async (raw) => {
    const data = platformConfigSchema
      .extend({
        id: z.number().optional(),
      })
      .parse(raw);
    const result = await createConfig({ ...data, source: "mcp" });
    publish("platform:configured", { platform: data.platform });
    return result;
  },
  platform_complete_onboarding: async (raw) => {
    const { platform } = platformSchema.parse(raw);
    await completeOnboarding(platform);
    return { success: true, platform, status: "completed" };
  },
};
