import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { state, db, getPlatformAdapter, getPlatformDefinition, listPlatformDefinitions } =
  vi.hoisted(() => {
    const state = {
      configIdCounter: 1,
      runIdCounter: 1,
      platformCatalog: [] as Array<Record<string, unknown>>,
      platformOnboardingRuns: [] as Array<Record<string, unknown>>,
      scraperConfigs: [] as Array<Record<string, unknown>>,
    };

    const getPlatformAdapter = vi.fn();
    const getPlatformDefinition = vi.fn(() => null);
    const listPlatformDefinitions = vi.fn(() => []);

    type Condition = { column: string; value: unknown } | undefined;

    function createSelectChain() {
      let tableName = "";
      let condition: Condition;
      let limitCount: number | undefined;

      const chain = Object.assign(
        Promise.resolve().then(() => {
          let rows = [
            ...(state[tableName as keyof typeof state] as Array<Record<string, unknown>>),
          ];

          if (condition) {
            rows = rows.filter((row) => row[condition.column] === condition.value);
          }

          if (tableName === "platformOnboardingRuns") {
            rows.sort((left, right) => {
              const leftTime = new Date(String(left.updatedAt ?? 0)).getTime();
              const rightTime = new Date(String(right.updatedAt ?? 0)).getTime();
              return rightTime - leftTime;
            });
          }

          if (typeof limitCount === "number") {
            rows = rows.slice(0, limitCount);
          }

          return rows;
        }),
        {
          from: vi.fn((table: { __table: string }) => {
            tableName = table.__table;
            return chain;
          }),
          where: vi.fn((nextCondition: Condition) => {
            condition = nextCondition;
            return chain;
          }),
          orderBy: vi.fn(() => chain),
          limit: vi.fn((count: number) => {
            limitCount = count;
            return chain;
          }),
        },
      );

      return chain;
    }

    function createUpdateChain(table: { __table: string }) {
      let patch: Record<string, unknown> = {};
      let condition: Condition;

      return {
        set(nextPatch: Record<string, unknown>) {
          patch = nextPatch;
          return this;
        },
        where(nextCondition: Condition) {
          condition = nextCondition;
          return {
            returning: async () => {
              const rows = state[table.__table as keyof typeof state] as Array<
                Record<string, unknown>
              >;
              const index = rows.findIndex((row) =>
                condition ? row[condition.column] === condition.value : true,
              );

              if (index === -1) {
                return [];
              }

              rows[index] = { ...rows[index], ...patch };
              return [rows[index]];
            },
          };
        },
      };
    }

    function createInsertChain(table: { __table: string }) {
      return {
        values(values: Record<string, unknown>) {
          return {
            onConflictDoNothing: async () => {
              const rows = state[table.__table as keyof typeof state] as Array<
                Record<string, unknown>
              >;
              if (table.__table === "platformCatalog") {
                const slug = values.slug;
                if (!rows.some((row) => row.slug === slug)) {
                  rows.push({
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ...values,
                  });
                }
              }
            },
            returning: async () => {
              const rows = state[table.__table as keyof typeof state] as Array<
                Record<string, unknown>
              >;
              const inserted = {
                ...(table.__table === "scraperConfigs"
                  ? { id: `cfg-${state.configIdCounter++}` }
                  : table.__table === "platformOnboardingRuns"
                    ? { id: `run-${state.runIdCounter++}` }
                    : {}),
                createdAt: new Date(),
                updatedAt: new Date(),
                ...values,
              };
              rows.push(inserted);
              return [inserted];
            },
          };
        },
      };
    }

    const db = {
      select: vi.fn(() => createSelectChain()),
      update: vi.fn((table: { __table: string }) => createUpdateChain(table)),
      insert: vi.fn((table: { __table: string }) => createInsertChain(table)),
      execute: vi.fn(async () => ({ rows: [] })),
    };

    return {
      state,
      db,
      getPlatformAdapter,
      getPlatformDefinition,
      listPlatformDefinitions,
    };
  });

vi.mock("@/src/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db,
}));
vi.mock("../src/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db,
}));
vi.mock("../src/db/schema", () => ({
  platformCatalog: {
    __table: "platformCatalog",
    slug: "slug",
  },
  platformOnboardingRuns: {
    __table: "platformOnboardingRuns",
    id: "id",
    platformSlug: "platformSlug",
    configId: "configId",
    source: "source",
    status: "status",
    currentStep: "currentStep",
    blockerKind: "blockerKind",
    nextActions: "nextActions",
    evidence: "evidence",
    result: "result",
    startedAt: "startedAt",
    completedAt: "completedAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  scrapeResults: {
    __table: "scrapeResults",
  },
  scraperConfigs: {
    __table: "scraperConfigs",
    id: "id",
    platform: "platform",
  },
}));
vi.mock("drizzle-orm", () => ({
  asc: vi.fn(),
  desc: vi.fn(),
  eq: (column: string, value: unknown) => ({ column, value }),
  gte: vi.fn(),
  sql: vi.fn(),
}));
vi.mock("@motian/scrapers", () => ({
  getPlatformAdapter,
  getPlatformDefinition,
  listPlatformDefinitions,
}));
vi.mock("../src/lib/crypto", () => ({
  encrypt: (value: string) => `enc:${value}`,
  decrypt: (value: string) => value.replace(/^enc:/, ""),
}));

import {
  didConnectionSettingsChange,
  encryptAuthConfig,
  listPlatformCatalog,
  triggerTestRun,
  validateConfig,
} from "../src/services/scrapers";

describe("platform config service regressions", () => {
  beforeEach(() => {
    state.configIdCounter = 1;
    state.runIdCounter = 1;
    state.platformCatalog = [];
    state.platformOnboardingRuns = [];
    state.scraperConfigs = [
      {
        id: "cfg-customboard",
        platform: "customboard",
        baseUrl: "https://custom.example",
        isActive: false,
        parameters: { sourcePath: "/jobs" },
        authConfigEncrypted: encryptAuthConfig({ apiKey: "super-secret" }),
        credentialsRef: "vault://customboard",
        cronExpression: "0 0 */4 * * *",
        validationStatus: "unknown",
        lastValidatedAt: null,
        lastValidationError: null,
        lastTestImportAt: null,
        lastTestImportStatus: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    getPlatformAdapter.mockReset();
    getPlatformDefinition.mockClear();
    listPlatformDefinitions.mockClear();
    getPlatformAdapter.mockReturnValue(undefined);
  });

  it("prefers built-in platform docs metadata over stale catalog rows", async () => {
    const werkzoekenDefinition = {
      slug: "werkzoeken",
      displayName: "Werkzoeken",
      adapterKind: "http_html_list_detail",
      authMode: "none",
      attributionLabel: "Werkzoeken.nl",
      capabilities: ["configurable_path", "pagination"],
      description: "Publieke SSR vacaturekaartjes met de officiële documentatie",
      docsUrl: "https://www.werkzoeken.nl/doc/",
      defaultBaseUrl: "https://www.werkzoeken.nl",
      configSchema: z.object({ sourcePath: z.string().optional() }),
      authSchema: z.object({}),
    };

    listPlatformDefinitions.mockReturnValue([werkzoekenDefinition]);
    getPlatformDefinition.mockImplementation((slug: string) =>
      slug === "werkzoeken" ? werkzoekenDefinition : null,
    );
    state.platformCatalog = [
      {
        slug: "werkzoeken",
        displayName: "Werkzoeken",
        adapterKind: "http_html_list_detail",
        authMode: "none",
        attributionLabel: "Werkzoeken.nl",
        description: "Stale description from an older seed",
        capabilities: ["configurable_path", "pagination"],
        docsUrl: "https://www.werkzoeken.nl/vacatures-voor/techniek/",
        defaultBaseUrl: "https://www.werkzoeken.nl",
        isEnabled: true,
        isSelfServe: true,
        updatedAt: new Date(),
      },
    ];

    const catalog = await listPlatformCatalog();
    const werkzoeken = catalog.find((entry) => entry.slug === "werkzoeken");

    expect(werkzoeken?.description).toBe(werkzoekenDefinition.description);
    expect(werkzoeken?.docsUrl).toBe(werkzoekenDefinition.docsUrl);
  });

  it("redacts secret config fields when unsupported platforms are validated or test-imported", async () => {
    const validation = await validateConfig("customboard", "agent");
    const testImport = await triggerTestRun("customboard", "agent", 2);

    expect(validation.config).toMatchObject({
      id: "cfg-customboard",
      platform: "customboard",
      baseUrl: "https://custom.example",
    });
    expect(validation.config).not.toHaveProperty("authConfigEncrypted");
    expect(validation.config).not.toHaveProperty("credentialsRef");
    expect(testImport.config).not.toHaveProperty("authConfigEncrypted");
    expect(testImport.config).not.toHaveProperty("credentialsRef");
  });

  it("compares decrypted auth payloads instead of ciphertext blobs", () => {
    const existing = {
      id: "cfg-1",
      platform: "werkzoeken",
      baseUrl: "https://www.werkzoeken.nl",
      isActive: false,
      parameters: { sourcePath: "/vacatures-voor/techniek/" },
      authConfigEncrypted: encryptAuthConfig({ username: "motian", password: "same-secret" }),
      credentialsRef: null,
      cronExpression: "0 0 */4 * * *",
      validationStatus: "validated",
      lastValidatedAt: new Date(),
      lastValidationError: null,
      lastTestImportAt: null,
      lastTestImportStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const changed = didConnectionSettingsChange(existing, {
      authConfigEncrypted: encryptAuthConfig({ username: "motian", password: "same-secret" }),
      baseUrl: "https://www.werkzoeken.nl",
      credentialsRef: null,
      parameters: { sourcePath: "/vacatures-voor/techniek/" },
    });

    expect(changed).toBe(false);
  });
});
