import {
  getPlatformAdapter,
  getPlatformDefinition,
  listPlatformDefinitions,
  type PlatformBlockerKind,
  type PlatformRuntimeConfig,
  type PlatformTestImportResult,
  type PlatformValidationResult,
} from "@motian/scrapers";
import { asc, desc, eq, gte, sql } from "drizzle-orm";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { db } from "../db";
import {
  platformCatalog,
  platformOnboardingRuns,
  scrapeResults,
  scraperConfigs,
} from "../db/schema";
import { decrypt, encrypt } from "../lib/crypto";
import {
  canActivatePlatformOnboarding,
  createPlatformOnboardingRunDraft,
  type PlatformOnboardingRunState,
  type PlatformOnboardingSource,
  reducePlatformOnboardingRun,
} from "./platform-onboarding";

// ========== Types ==========

export type ScraperConfig = typeof scraperConfigs.$inferSelect;
export type SanitizedScraperConfig = Omit<ScraperConfig, "authConfigEncrypted" | "credentialsRef">;
export type PlatformCatalogRow = typeof platformCatalog.$inferSelect;
export type PlatformOnboardingRunRecord = typeof platformOnboardingRuns.$inferSelect;
type LatestPlatformOnboardingRunRow = PlatformOnboardingRunRecord;

export type PlatformHealth = {
  platform: string;
  isActive: boolean;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  consecutiveFailures: number;
  circuitBreakerOpen: boolean;
  runs24h: number;
  failures24h: number;
  failureRate: number;
  status: "gezond" | "waarschuwing" | "kritiek" | "inactief";
};

export type HealthReport = {
  data: PlatformHealth[];
  overall: "gezond" | "waarschuwing" | "kritiek";
};

export type UpdateConfigData = {
  authConfig?: Record<string, unknown>;
  baseUrl?: string;
  cronExpression?: string;
  credentialsRef?: string;
  isActive?: boolean;
  parameters?: Record<string, unknown>;
};

export type CreatePlatformCatalogData = {
  slug: string;
  displayName?: string;
  adapterKind?: string;
  authMode?: string;
  attributionLabel?: string;
  description?: string;
  capabilities?: string[];
  docsUrl?: string;
  defaultBaseUrl?: string;
  isEnabled?: boolean;
  isSelfServe?: boolean;
  configSchema?: Record<string, unknown>;
  authSchema?: Record<string, unknown>;
  source?: PlatformOnboardingSource;
};

export type CreatePlatformConfigData = {
  platform: string;
  authConfig?: Record<string, unknown>;
  baseUrl?: string;
  cronExpression?: string;
  credentialsRef?: string;
  isActive?: boolean;
  parameters?: Record<string, unknown>;
  source?: PlatformOnboardingSource;
};

export type PlatformCatalogEntryView = {
  slug: string;
  displayName: string;
  adapterKind: string;
  authMode: string;
  attributionLabel: string;
  description: string;
  capabilities: string[];
  docsUrl: string | null;
  defaultBaseUrl: string | null;
  configSchema: Record<string, unknown>;
  authSchema: Record<string, unknown>;
  isEnabled: boolean;
  isSelfServe: boolean;
  implemented: boolean;
  config: SanitizedScraperConfig | null;
  latestRun: PlatformOnboardingRunRecord | null;
};

export type PlatformValidationResponse = PlatformValidationResult & {
  config: SanitizedScraperConfig;
  onboardingRun: PlatformOnboardingRunRecord;
};

export type PlatformTestImportResponse = PlatformTestImportResult & {
  config: SanitizedScraperConfig;
  onboardingRun: PlatformOnboardingRunRecord;
};

export type PlatformOnboardingStatusResponse = {
  catalog: PlatformCatalogEntryView | null;
  config: SanitizedScraperConfig | null;
  latestRun: PlatformOnboardingRunRecord | null;
};

// ========== Private helpers ==========

function sanitizeConfig(config: ScraperConfig): SanitizedScraperConfig {
  // Omit server-side secrets — authConfigEncrypted and credentialsRef must not
  // be returned to API callers, agents, or CLI tooling.
  const { authConfigEncrypted: _a, credentialsRef: _b, ...rest } = config;
  return rest;
}

function serializeZodSchema(schema: z.ZodTypeAny) {
  return zodToJsonSchema(schema, { $refStrategy: "none" }) as Record<string, unknown>;
}

function fallbackDisplayName(slug: string) {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function onboardingStateFromRecord(
  record: PlatformOnboardingRunRecord,
  supported: boolean,
): PlatformOnboardingRunState {
  return {
    platform: record.platformSlug,
    source: record.source as PlatformOnboardingSource,
    supported,
    status: record.status as PlatformOnboardingRunState["status"],
    currentStep: record.currentStep as PlatformOnboardingRunState["currentStep"],
    nextActions: Array.isArray(record.nextActions) ? (record.nextActions as string[]) : [],
    blockerKind: (record.blockerKind as PlatformBlockerKind | null) ?? null,
    configId: record.configId ?? undefined,
    evidence:
      record.evidence && typeof record.evidence === "object"
        ? (record.evidence as Record<string, unknown>)
        : {},
  };
}

async function recordOnboardingSnapshot(input: {
  platform: string;
  source: PlatformOnboardingSource;
  configId?: string | null;
  event:
    | Parameters<typeof reducePlatformOnboardingRun>[1]
    | {
        type: "unsupported_source_detected";
        blockerKind: "needs_implementation";
        evidence?: Record<string, unknown>;
      };
}): Promise<PlatformOnboardingRunRecord> {
  const supported = Boolean(getPlatformAdapter(input.platform));
  const latest = await getLatestOnboardingRun(input.platform);
  const initial = latest
    ? onboardingStateFromRecord(latest, supported)
    : createPlatformOnboardingRunDraft({
        platform: input.platform,
        source: input.source,
        supported,
      });
  const next = reducePlatformOnboardingRun(initial, input.event);

  const [record] = await db
    .insert(platformOnboardingRuns)
    .values({
      platformSlug: input.platform,
      configId: next.configId ?? input.configId ?? null,
      source: input.source,
      status: next.status,
      currentStep: next.currentStep,
      blockerKind: next.blockerKind,
      nextActions: next.nextActions,
      evidence: next.evidence,
      result: input.event.evidence ?? {},
      completedAt:
        next.status === "active" || next.status === "needs_implementation" ? new Date() : null,
      updatedAt: new Date(),
    })
    .returning();

  return record;
}

async function ensureOnboardingDraft(
  platform: string,
  source: PlatformOnboardingSource,
): Promise<void> {
  const existing = await getLatestOnboardingRun(platform);
  if (existing) {
    return;
  }

  const draft = createPlatformOnboardingRunDraft({
    platform,
    source,
    supported: Boolean(getPlatformAdapter(platform)),
  });

  await db.insert(platformOnboardingRuns).values({
    platformSlug: platform,
    source,
    status: draft.status,
    currentStep: draft.currentStep,
    blockerKind: draft.blockerKind,
    nextActions: draft.nextActions,
    evidence: draft.evidence,
    result: {},
    updatedAt: new Date(),
  });
}

async function listLatestOnboardingRuns(): Promise<PlatformOnboardingRunRecord[]> {
  const result = await db.execute(sql<LatestPlatformOnboardingRunRow>`
    select distinct on (${platformOnboardingRuns.platformSlug})
      ${platformOnboardingRuns.id} as "id",
      ${platformOnboardingRuns.platformSlug} as "platformSlug",
      ${platformOnboardingRuns.configId} as "configId",
      ${platformOnboardingRuns.source} as "source",
      ${platformOnboardingRuns.status} as "status",
      ${platformOnboardingRuns.currentStep} as "currentStep",
      ${platformOnboardingRuns.blockerKind} as "blockerKind",
      ${platformOnboardingRuns.nextActions} as "nextActions",
      ${platformOnboardingRuns.evidence} as "evidence",
      ${platformOnboardingRuns.result} as "result",
      ${platformOnboardingRuns.startedAt} as "startedAt",
      ${platformOnboardingRuns.completedAt} as "completedAt",
      ${platformOnboardingRuns.createdAt} as "createdAt",
      ${platformOnboardingRuns.updatedAt} as "updatedAt"
    from ${platformOnboardingRuns}
    order by
      ${platformOnboardingRuns.platformSlug} asc,
      ${platformOnboardingRuns.updatedAt} desc nulls last,
      ${platformOnboardingRuns.id} desc
  `);

  return result.rows as PlatformOnboardingRunRecord[];
}

export function toRuntimeConfig(platform: string, config: ScraperConfig): PlatformRuntimeConfig {
  return {
    slug: platform,
    baseUrl: config.baseUrl,
    parameters:
      config.parameters && typeof config.parameters === "object"
        ? (config.parameters as Record<string, unknown>)
        : {},
    auth:
      config.authConfigEncrypted && isEncrypted(config.authConfigEncrypted)
        ? decryptAuthConfig(config.authConfigEncrypted)
        : {},
    credentialsRef: config.credentialsRef ?? undefined,
  };
}

// ========== Service Functions ==========

export async function listPlatformCatalog(): Promise<PlatformCatalogEntryView[]> {
  const [catalogRows, configs, runs] = await Promise.all([
    db.select().from(platformCatalog).orderBy(asc(platformCatalog.slug)),
    db.select().from(scraperConfigs).orderBy(asc(scraperConfigs.platform)),
    listLatestOnboardingRuns(),
  ]);

  const definitions = listPlatformDefinitions();
  const configMap = new Map(configs.map((config) => [config.platform, config]));
  const catalogMap = new Map(catalogRows.map((row) => [row.slug, row]));
  const latestRunMap = new Map<string, PlatformOnboardingRunRecord>();

  for (const run of runs) {
    if (!latestRunMap.has(run.platformSlug)) {
      latestRunMap.set(run.platformSlug, run);
    }
  }

  const slugs = new Set([
    ...definitions.map((definition) => definition.slug),
    ...catalogRows.map((row) => row.slug),
  ]);

  return [...slugs]
    .sort((left, right) => left.localeCompare(right))
    .map((slug) => {
      const definition = getPlatformDefinition(slug);
      const row = catalogMap.get(slug);

      return {
        slug,
        displayName: row?.displayName ?? definition?.displayName ?? fallbackDisplayName(slug),
        adapterKind: row?.adapterKind ?? definition?.adapterKind ?? "http_html_list_detail",
        authMode: row?.authMode ?? definition?.authMode ?? "none",
        attributionLabel:
          row?.attributionLabel ?? definition?.attributionLabel ?? fallbackDisplayName(slug),
        description: row?.description ?? definition?.description ?? "",
        capabilities:
          (Array.isArray(row?.capabilities) ? (row?.capabilities as string[]) : undefined) ??
          definition?.capabilities ??
          [],
        docsUrl: row?.docsUrl ?? definition?.docsUrl ?? null,
        defaultBaseUrl: row?.defaultBaseUrl ?? definition?.defaultBaseUrl ?? null,
        configSchema:
          (row?.configSchema as Record<string, unknown> | undefined) ??
          (definition ? serializeZodSchema(definition.configSchema) : {}),
        authSchema:
          (row?.authSchema as Record<string, unknown> | undefined) ??
          (definition ? serializeZodSchema(definition.authSchema) : {}),
        isEnabled: row?.isEnabled ?? true,
        isSelfServe: row?.isSelfServe ?? Boolean(definition),
        implemented: Boolean(getPlatformAdapter(slug)),
        config: (() => { const c = configMap.get(slug); return c ? sanitizeConfig(c) : null; })(),
        latestRun: latestRunMap.get(slug) ?? null,
      };
    });
}

export async function getPlatformCatalogEntry(
  slug: string,
): Promise<PlatformCatalogEntryView | null> {
  const entries = await listPlatformCatalog();
  return entries.find((entry) => entry.slug === slug) ?? null;
}

export async function createPlatformCatalogEntry(
  data: CreatePlatformCatalogData,
): Promise<PlatformCatalogRow> {
  const definition = getPlatformDefinition(data.slug);

  const [row] = await db
    .insert(platformCatalog)
    .values({
      slug: data.slug,
      displayName: data.displayName ?? definition?.displayName ?? fallbackDisplayName(data.slug),
      adapterKind: data.adapterKind ?? definition?.adapterKind ?? "http_html_list_detail",
      authMode: data.authMode ?? definition?.authMode ?? "none",
      attributionLabel:
        data.attributionLabel ?? definition?.attributionLabel ?? fallbackDisplayName(data.slug),
      description: data.description ?? definition?.description ?? "",
      capabilities: data.capabilities ?? definition?.capabilities ?? [],
      docsUrl: data.docsUrl ?? definition?.docsUrl ?? null,
      defaultBaseUrl: data.defaultBaseUrl ?? definition?.defaultBaseUrl ?? null,
      configSchema:
        data.configSchema ?? (definition ? serializeZodSchema(definition.configSchema) : {}),
      authSchema: data.authSchema ?? (definition ? serializeZodSchema(definition.authSchema) : {}),
      isEnabled: data.isEnabled ?? true,
      isSelfServe: data.isSelfServe ?? Boolean(definition),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformCatalog.slug,
      set: {
        displayName: data.displayName ?? definition?.displayName ?? fallbackDisplayName(data.slug),
        adapterKind: data.adapterKind ?? definition?.adapterKind ?? "http_html_list_detail",
        authMode: data.authMode ?? definition?.authMode ?? "none",
        attributionLabel:
          data.attributionLabel ?? definition?.attributionLabel ?? fallbackDisplayName(data.slug),
        description: data.description ?? definition?.description ?? "",
        capabilities: data.capabilities ?? definition?.capabilities ?? [],
        docsUrl: data.docsUrl ?? definition?.docsUrl ?? null,
        defaultBaseUrl: data.defaultBaseUrl ?? definition?.defaultBaseUrl ?? null,
        configSchema:
          data.configSchema ?? (definition ? serializeZodSchema(definition.configSchema) : {}),
        authSchema:
          data.authSchema ?? (definition ? serializeZodSchema(definition.authSchema) : {}),
        isEnabled: data.isEnabled ?? true,
        isSelfServe: data.isSelfServe ?? Boolean(definition),
        updatedAt: new Date(),
      },
    })
    .returning();

  await ensureOnboardingDraft(data.slug, data.source ?? "system");

  return row;
}

export async function updatePlatformCatalogEntry(
  slug: string,
  data: Omit<CreatePlatformCatalogData, "slug">,
): Promise<PlatformCatalogRow> {
  const existing = await db
    .select()
    .from(platformCatalog)
    .where(eq(platformCatalog.slug, slug))
    .limit(1);

  if (!existing[0]) {
    throw new Error(`Platform catalogus entry voor "${slug}" niet gevonden`);
  }

  // True PATCH: only update fields that are explicitly provided.
  const patchSet: Partial<typeof platformCatalog.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (data.displayName !== undefined) patchSet.displayName = data.displayName;
  if (data.adapterKind !== undefined) patchSet.adapterKind = data.adapterKind;
  if (data.authMode !== undefined) patchSet.authMode = data.authMode;
  if (data.attributionLabel !== undefined) patchSet.attributionLabel = data.attributionLabel;
  if (data.description !== undefined) patchSet.description = data.description;
  if (data.capabilities !== undefined) patchSet.capabilities = data.capabilities;
  if (data.docsUrl !== undefined) patchSet.docsUrl = data.docsUrl;
  if (data.defaultBaseUrl !== undefined) patchSet.defaultBaseUrl = data.defaultBaseUrl;
  if (data.configSchema !== undefined) patchSet.configSchema = data.configSchema;
  if (data.authSchema !== undefined) patchSet.authSchema = data.authSchema;
  if (data.isEnabled !== undefined) patchSet.isEnabled = data.isEnabled;
  if (data.isSelfServe !== undefined) patchSet.isSelfServe = data.isSelfServe;

  const [updated] = await db
    .update(platformCatalog)
    .set(patchSet)
    .where(eq(platformCatalog.slug, slug))
    .returning();

  return updated;
}

/** Alle scraper configuraties ophalen, gesorteerd op platform */
export async function getAllConfigs(): Promise<ScraperConfig[]> {
  return db.select().from(scraperConfigs).orderBy(asc(scraperConfigs.platform));
}

export async function getConfigByPlatform(platform: string): Promise<ScraperConfig | null> {
  const [config] = await db
    .select()
    .from(scraperConfigs)
    .where(eq(scraperConfigs.platform, platform))
    .limit(1);

  return config ?? null;
}

export async function createConfig(data: CreatePlatformConfigData): Promise<ScraperConfig> {
  const catalog = await getPlatformCatalogEntry(data.platform);
  const baseUrl = data.baseUrl ?? catalog?.defaultBaseUrl;
  if (!baseUrl) {
    throw new Error(`Geen baseUrl beschikbaar voor platform ${data.platform}`);
  }

  const [config] = await db
    .insert(scraperConfigs)
    .values({
      platform: data.platform,
      baseUrl,
      isActive: data.isActive ?? false,
      parameters: data.parameters ?? {},
      authConfigEncrypted: data.authConfig ? encryptAuthConfig(data.authConfig) : null,
      credentialsRef: data.credentialsRef ?? null,
      cronExpression: data.cronExpression ?? "0 0 */4 * * *",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: scraperConfigs.platform,
      set: {
        baseUrl,
        isActive: data.isActive ?? false,
        parameters: data.parameters ?? {},
        authConfigEncrypted: data.authConfig ? encryptAuthConfig(data.authConfig) : null,
        credentialsRef: data.credentialsRef ?? null,
        cronExpression: data.cronExpression ?? "0 0 */4 * * *",
        updatedAt: new Date(),
      },
    })
    .returning();

  await recordOnboardingSnapshot({
    platform: data.platform,
    source: data.source ?? "ui",
    configId: config.id,
    event: {
      type: "config_saved",
      configId: config.id,
      evidence: {
        baseUrl: config.baseUrl,
      },
    },
  });

  return config;
}

/** Eén scraper configuratie bijwerken op ID. Geeft de bijgewerkte rij terug, of null als niet gevonden. */
export async function updateConfig(
  id: string,
  data: UpdateConfigData,
): Promise<ScraperConfig | null> {
  // Read current row to detect connection-setting changes.
  const [current] = await db
    .select()
    .from(scraperConfigs)
    .where(eq(scraperConfigs.id, id))
    .limit(1);

  // If baseUrl, authConfig, credentialsRef or parameters changed, previous
  // validation and smoke-import results are no longer valid.
  const connectionChanged =
    Boolean(current) &&
    ((data.baseUrl !== undefined && data.baseUrl !== current.baseUrl) ||
      data.authConfig !== undefined ||
      (data.credentialsRef !== undefined && data.credentialsRef !== current.credentialsRef) ||
      (data.parameters !== undefined &&
        JSON.stringify(data.parameters) !== JSON.stringify(current.parameters)));

  const resetValidation = connectionChanged
    ? {
        validationStatus: "unknown",
        lastValidatedAt: null,
        lastValidationError: null,
        lastTestImportAt: null,
        lastTestImportStatus: null,
      }
    : {};

  const result = await db
    .update(scraperConfigs)
    .set({
      authConfigEncrypted: data.authConfig ? encryptAuthConfig(data.authConfig) : undefined,
      baseUrl: data.baseUrl,
      cronExpression: data.cronExpression,
      credentialsRef: data.credentialsRef,
      isActive: data.isActive,
      parameters: data.parameters,
      ...resetValidation,
      updatedAt: new Date(),
    })
    .where(eq(scraperConfigs.id, id))
    .returning();

  return result[0] ?? null;
}

export async function getLatestOnboardingRun(
  platform: string,
): Promise<PlatformOnboardingRunRecord | null> {
  const [run] = await db
    .select()
    .from(platformOnboardingRuns)
    .where(eq(platformOnboardingRuns.platformSlug, platform))
    .orderBy(desc(platformOnboardingRuns.updatedAt))
    .limit(1);

  return run ?? null;
}

export async function validateConfig(
  platform: string,
  source: PlatformOnboardingSource = "ui",
): Promise<PlatformValidationResponse> {
  const config = await getConfigByPlatform(platform);
  if (!config) {
    throw new Error(`Geen scraper configuratie gevonden voor ${platform}`);
  }

  const adapter = getPlatformAdapter(platform);
  if (!adapter) {
    const onboardingRun = await recordOnboardingSnapshot({
      platform,
      source,
      configId: config.id,
      event: {
        type: "unsupported_source_detected",
        blockerKind: "needs_implementation",
        evidence: {
          message: "Platform heeft nog geen runtime adapter implementatie",
        },
      },
    });

    return {
      ok: false,
      status: "needs_implementation",
      message: "Dit platform vereist nog een adapter implementatie.",
      blockerKind: "needs_implementation",
      evidence: {
        platform,
      },
      config,
      onboardingRun,
    };
  }

  const result = await adapter.validate(toRuntimeConfig(platform, config));
  await db
    .update(scraperConfigs)
    .set({
      validationStatus: result.status,
      lastValidatedAt: new Date(),
      lastValidationError: result.ok ? null : result.message,
      updatedAt: new Date(),
    })
    .where(eq(scraperConfigs.id, config.id));

  const onboardingRun = await recordOnboardingSnapshot({
    platform,
    source,
    configId: config.id,
    event: result.ok
      ? { type: "validated", evidence: result.evidence }
      : result.status === "needs_implementation"
        ? {
            type: "unsupported_source_detected",
            blockerKind: "needs_implementation",
            evidence: result.evidence,
          }
        : {
            type: "validation_failed",
            blockerKind: result.blockerKind ?? "unexpected_markup",
            evidence: {
              message: result.message,
              ...(result.evidence ?? {}),
            },
          },
  });

  return {
    ...result,
    config: sanitizeConfig({
      ...config,
      validationStatus: result.status,
      lastValidatedAt: new Date(),
      lastValidationError: result.ok ? null : result.message,
    }),
    onboardingRun,
  };
}

export async function triggerTestRun(
  platform: string,
  source: PlatformOnboardingSource = "ui",
  limit = 3,
): Promise<PlatformTestImportResponse> {
  const config = await getConfigByPlatform(platform);
  if (!config) {
    throw new Error(`Geen scraper configuratie gevonden voor ${platform}`);
  }

  const adapter = getPlatformAdapter(platform);
  if (!adapter) {
    const onboardingRun = await recordOnboardingSnapshot({
      platform,
      source,
      configId: config.id,
      event: {
        type: "unsupported_source_detected",
        blockerKind: "needs_implementation",
        evidence: {
          message: "Platform heeft nog geen runtime adapter implementatie",
        },
      },
    });

    return {
      status: "needs_implementation",
      jobsFound: 0,
      listings: [],
      blockerKind: "needs_implementation",
      errors: ["Geen runtime adapter beschikbaar voor dit platform."],
      config,
      onboardingRun,
    };
  }

  const result = await adapter.testImport(toRuntimeConfig(platform, config), { limit });
  await db
    .update(scraperConfigs)
    .set({
      lastTestImportAt: new Date(),
      lastTestImportStatus: result.status,
      updatedAt: new Date(),
    })
    .where(eq(scraperConfigs.id, config.id));

  const onboardingRun = await recordOnboardingSnapshot({
    platform,
    source,
    configId: config.id,
    event:
      result.status === "success" || result.status === "partial"
        ? {
            type: "smoke_import_succeeded",
            evidence: {
              jobsFound: result.jobsFound,
              blockerKind: result.blockerKind,
              ...(result.evidence ?? {}),
            },
          }
        : result.status === "needs_implementation"
          ? {
              type: "unsupported_source_detected",
              blockerKind: "needs_implementation",
              evidence: result.evidence,
            }
          : {
              type: "smoke_import_failed",
              blockerKind: result.blockerKind,
              evidence: {
                jobsFound: result.jobsFound,
                errors: result.errors,
                ...(result.evidence ?? {}),
              },
            },
  });

  return {
    ...result,
    config: sanitizeConfig({
      ...config,
      lastTestImportAt: new Date(),
      lastTestImportStatus: result.status,
    }),
    onboardingRun,
  };
}

export async function activatePlatform(
  platform: string,
  source: PlatformOnboardingSource = "ui",
): Promise<ScraperConfig> {
  const config = await getConfigByPlatform(platform);
  if (!config) {
    throw new Error(`Geen scraper configuratie gevonden voor ${platform}`);
  }

  const latestRun = await getLatestOnboardingRun(platform);
  const latestRunStatus = latestRun?.status as PlatformOnboardingRunState["status"] | null;

  if (
    !canActivatePlatformOnboarding({
      isActive: config.isActive,
      latestRunStatus,
      validationStatus: config.validationStatus,
      lastTestImportStatus: config.lastTestImportStatus,
    })
  ) {
    const stateDescription = latestRunStatus
      ? `status "${latestRunStatus}"`
      : "een onvolledige onboarding zonder succesvolle validatie en smoke import";
    throw new Error(
      `Platform ${platform} kan niet worden geactiveerd vanuit ${stateDescription}. Rond eerst validatie en smoke import af.`,
    );
  }

  const [updated] = await db
    .update(scraperConfigs)
    .set({
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(scraperConfigs.id, config.id))
    .returning();

  await recordOnboardingSnapshot({
    platform,
    source,
    configId: config.id,
    event: {
      type: "activated",
      evidence: {
        activatedAt: new Date().toISOString(),
      },
    },
  });

  return updated;
}

export async function getPlatformOnboardingStatus(
  platform: string,
): Promise<PlatformOnboardingStatusResponse> {
  const [catalog, config, latestRun] = await Promise.all([
    getPlatformCatalogEntry(platform),
    getConfigByPlatform(platform),
    getLatestOnboardingRun(platform),
  ]);

  return {
    catalog,
    config: config ? sanitizeConfig(config) : null,
    latestRun,
  };
}

export async function runPlatformOnboardingWorkflow(input: {
  source?: PlatformOnboardingSource;
  config: CreatePlatformConfigData;
  activate?: boolean;
}): Promise<{
  config: ScraperConfig;
  validation: PlatformValidationResponse;
  testImport: PlatformTestImportResponse;
  activated: boolean;
}> {
  const config = await createConfig(input.config);
  const validation = await validateConfig(config.platform, input.source ?? input.config.source);
  const testImport = await triggerTestRun(config.platform, input.source ?? input.config.source);
  const shouldActivate =
    input.activate !== false &&
    validation.ok &&
    (testImport.status === "success" || testImport.status === "partial");

  if (shouldActivate) {
    await activatePlatform(config.platform, input.source ?? input.config.source);
  }

  return {
    config,
    validation,
    testImport,
    activated: shouldActivate,
  };
}

/** Platform gezondheidsrapport: status per scraper + 24-uurs failure rate */
export async function getHealth(): Promise<HealthReport> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [configs, statsRows] = await Promise.all([
    db.select().from(scraperConfigs),
    db
      .select({
        platform: scrapeResults.platform,
        total: sql<number>`count(*)::int`,
        failures: sql<number>`count(*) filter (where ${scrapeResults.status} = 'failed')::int`,
      })
      .from(scrapeResults)
      .where(gte(scrapeResults.runAt, twentyFourHoursAgo))
      .groupBy(scrapeResults.platform),
  ]);

  const statsMap = new Map(statsRows.map((stats) => [stats.platform, stats]));

  const health: PlatformHealth[] = configs.map((cfg) => {
    const failures = cfg.consecutiveFailures ?? 0;

    if (!cfg.isActive) {
      return {
        platform: cfg.platform,
        isActive: false,
        lastRunAt: cfg.lastRunAt,
        lastRunStatus: cfg.lastRunStatus,
        consecutiveFailures: failures,
        circuitBreakerOpen: failures >= 5,
        runs24h: 0,
        failures24h: 0,
        failureRate: 0,
        status: "inactief" as const,
      };
    }

    const stats = statsMap.get(cfg.platform);
    const runs24h = stats?.total ?? 0;
    const failures24h = stats?.failures ?? 0;
    const failureRate = runs24h > 0 ? failures24h / runs24h : 0;

    let status: PlatformHealth["status"] = "gezond";
    if (failures24h > 3) {
      status = "kritiek";
    } else if (failures24h > 0) {
      status = "waarschuwing";
    }

    if (failures >= 5) {
      status = "kritiek";
    }

    return {
      platform: cfg.platform,
      isActive: cfg.isActive,
      lastRunAt: cfg.lastRunAt,
      lastRunStatus: cfg.lastRunStatus,
      consecutiveFailures: failures,
      circuitBreakerOpen: failures >= 5,
      runs24h,
      failures24h,
      failureRate: Math.round(failureRate * 100) / 100,
      status,
    };
  });

  const overall: HealthReport["overall"] = health.some((entry) => entry.status === "kritiek")
    ? "kritiek"
    : health.some((entry) => entry.status === "waarschuwing")
      ? "waarschuwing"
      : "gezond";

  return { data: health, overall };
}

// ========== Auth Config Encryption ==========

/** Encrypt een auth config object naar een versleutelde string */
export function encryptAuthConfig(config: Record<string, unknown>): string {
  return encrypt(JSON.stringify(config));
}

/** Decrypt een versleutelde string terug naar auth config object */
export function decryptAuthConfig(encoded: string): Record<string, unknown> {
  return JSON.parse(decrypt(encoded));
}

/**
 * Detecteer of een waarde al versleuteld is.
 * Encrypted waarden zijn base64 en minimaal 32 bytes (IV + tag).
 * Plaintext JSON begint altijd met '{'.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value || value.length === 0) return false;
  if (value.startsWith("{") || value.startsWith("[")) return false;
  if (value.length < 44) return false;
  try {
    const buf = Buffer.from(value, "base64");
    return buf.toString("base64") === value;
  } catch {
    return false;
  }
}
