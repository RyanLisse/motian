import { tool } from "ai";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { jsonObjectSchema } from "@/src/lib/json-value-schema";
import {
  activatePlatform,
  createConfig,
  createPlatformCatalogEntry,
  getPlatformOnboardingStatus,
  listPlatformCatalog,
  triggerTestRun,
  updateConfig,
  updatePlatformCatalogEntry,
  validateConfig,
} from "@/src/services/scrapers";

export const platformsList = tool({
  description:
    "Lijst alle ondersteunde platformcatalogus items inclusief config-status, onboarding status en blokkades.",
  inputSchema: z.object({}),
  execute: async () => {
    const entries = await listPlatformCatalog();
    return {
      total: entries.length,
      platforms: entries.map((entry) => ({
        slug: entry.slug,
        displayName: entry.displayName,
        adapterKind: entry.adapterKind,
        authMode: entry.authMode,
        implemented: entry.implemented,
        configured: Boolean(entry.config),
        validationStatus: entry.config?.validationStatus ?? "unknown",
        latestRunStatus: entry.latestRun?.status ?? null,
        blockerKind: entry.latestRun?.blockerKind ?? null,
      })),
    };
  },
});

export const platformCatalogCreate = tool({
  description: "Maak of seed een platform catalogus entry voor onboarding.",
  inputSchema: z.object({
    slug: z.string().min(1),
    displayName: z.string().optional(),
    adapterKind: z.string().optional(),
    authMode: z.string().optional(),
    attributionLabel: z.string().optional(),
    description: z.string().optional(),
    defaultBaseUrl: z.string().url().optional(),
    docsUrl: z.string().url().optional(),
  }),
  execute: async (input) => {
    const result = await createPlatformCatalogEntry({ ...input, source: "agent" });
    revalidateTag("scrapers");
    revalidateTag("default");
    return result;
  },
});

export const platformCatalogUpdate = tool({
  description: "Werk metadata van een platform catalogus entry bij.",
  inputSchema: z.object({
    slug: z.string().min(1),
    displayName: z.string().optional(),
    adapterKind: z.string().optional(),
    authMode: z.string().optional(),
    attributionLabel: z.string().optional(),
    description: z.string().optional(),
    defaultBaseUrl: z.string().url().optional(),
    docsUrl: z.string().url().optional(),
  }),
  execute: async ({ slug, ...input }) => {
    const result = await updatePlatformCatalogEntry(slug, input);
    revalidateTag("scrapers");
    revalidateTag("default");
    return result;
  },
});

export const platformConfigCreate = tool({
  description: "Maak of overschrijf de runtime config voor een platform onboarding flow.",
  inputSchema: z.object({
    platform: z.string().min(1),
    baseUrl: z.string().url().optional(),
    isActive: z.boolean().optional(),
    cronExpression: z.string().optional(),
    credentialsRef: z.string().optional(),
    parameters: jsonObjectSchema.optional(),
    authConfig: jsonObjectSchema.optional(),
  }),
  execute: async (input) => {
    const result = await createConfig({ ...input, source: "agent" });
    revalidateTag("scrapers");
    revalidateTag("default");
    return result;
  },
});

export const platformConfigUpdate = tool({
  description: "Werk een bestaande platform runtime config bij via config ID.",
  inputSchema: z.object({
    id: z.string().uuid(),
    baseUrl: z.string().url().optional(),
    isActive: z.boolean().optional(),
    cronExpression: z.string().optional(),
    credentialsRef: z.string().optional(),
    parameters: jsonObjectSchema.optional(),
    authConfig: jsonObjectSchema.optional(),
  }),
  execute: async ({ id, ...input }) => {
    const result = await updateConfig(id, input);
    revalidateTag("scrapers");
    revalidateTag("default");
    return result;
  },
});

export const platformConfigValidate = tool({
  description: "Valideer de opgeslagen toegang/configuratie voor een platform.",
  inputSchema: z.object({
    platform: z.string().min(1),
  }),
  execute: async ({ platform }) => {
    const result = await validateConfig(platform, "agent");
    revalidateTag("scrapers");
    revalidateTag("default");
    return result;
  },
});

export const platformTestImport = tool({
  description: "Draai een smoke import voor een platform en retourneer blocker/evidence details.",
  inputSchema: z.object({
    platform: z.string().min(1),
    limit: z.number().int().min(1).max(10).optional(),
  }),
  execute: async ({ platform, limit }) => {
    const result = await triggerTestRun(platform, "agent", limit ?? 3);
    revalidateTag("jobs");
    revalidateTag("scrape-results");
    revalidateTag("scrapers");
    revalidateTag("default");
    return result;
  },
});

export const platformActivate = tool({
  description: "Activeer een platform na succesvolle validatie en smoke import.",
  inputSchema: z.object({
    platform: z.string().min(1),
  }),
  execute: async ({ platform }) => {
    const result = await activatePlatform(platform, "agent");
    revalidateTag("scrapers");
    revalidateTag("default");
    return result;
  },
});

export const platformOnboardingStatus = tool({
  description:
    "Inspecteer de huidige onboarding status, config en blocker state voor een platform.",
  inputSchema: z.object({
    platform: z.string().min(1),
  }),
  execute: async ({ platform }) => getPlatformOnboardingStatus(platform),
});
