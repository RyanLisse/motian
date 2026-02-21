import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  uuid,
  uniqueIndex,
  index,
  boolean,
  real,
} from "drizzle-orm/pg-core";

// ========== Scraper Configuratie ==========
export const scraperConfigs = pgTable(
  "scraper_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: text("platform").notNull(),
    baseUrl: text("base_url").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    parameters: jsonb("parameters").default({}),
    authConfigEncrypted: text("auth_config_encrypted"),
    cronExpression: text("cron_expression").default("0 0 */4 * * *"),
    lastRunAt: timestamp("last_run_at"),
    lastRunStatus: text("last_run_status"),
    consecutiveFailures: integer("consecutive_failures").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    platformUniqueIdx: uniqueIndex("uq_scraper_configs_platform").on(
      table.platform,
    ),
  }),
);

// ========== Scrape Resultaten ==========
export const scrapeResults = pgTable(
  "scrape_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    configId: uuid("config_id").references(() => scraperConfigs.id, {
      onDelete: "set null",
    }),
    platform: text("platform").notNull(),
    runAt: timestamp("run_at").defaultNow(),
    durationMs: integer("duration_ms"),
    jobsFound: integer("jobs_found").default(0),
    jobsNew: integer("jobs_new").default(0),
    duplicates: integer("duplicates").default(0),
    status: text("status").notNull(), // "success" | "partial" | "failed"
    errors: jsonb("errors").default([]),
  },
  (table) => ({
    configIdIdx: index("idx_scrape_results_config_id").on(table.configId),
    runAtIdx: index("idx_scrape_results_run_at").on(table.runAt),
    platformIdx: index("idx_scrape_results_platform").on(table.platform),
  }),
);

// ========== Opdrachten ==========
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // === Identificatie ===
    platform: text("platform").notNull(), // "striive", "indeed", "linkedin"
    externalId: text("external_id").notNull(), // Striive: referentiecode (bijv. "BTBDN000695")
    externalUrl: text("external_url"), // Volledige URL naar opdracht detail pagina
    clientReferenceCode: text("client_reference_code"), // Striive: referentiecode opdrachtgever

    // === Kern informatie ===
    title: text("title").notNull(),
    company: text("company"), // Opdrachtgever: "Belastingdienst", "Rabobank"
    contractLabel: text("contract_label"), // Broker/tussenpersoon: "Between", "Striive"
    location: text("location"), // "Utrecht - Utrecht", "Den Haag - Zuid-Holland"
    province: text("province"), // Geëxtraheerd uit location
    description: text("description"),

    // === Tarieven & Posities ===
    rateMin: integer("rate_min"),
    rateMax: integer("rate_max"), // Striive: "Wat is het uurtarief?" (max)
    currency: text("currency").default("EUR"),
    positionsAvailable: integer("positions_available").default(1),

    // === Data & Deadlines ===
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    applicationDeadline: timestamp("application_deadline"),
    postedAt: timestamp("posted_at"),

    // === Werkcondities ===
    contractType: text("contract_type"), // "freelance", "interim", "vast", "opdracht"
    workArrangement: text("work_arrangement"), // "hybride", "op_locatie", "remote"
    allowsSubcontracting: boolean("allows_subcontracting"),

    // === Gestructureerde Eisen ===
    requirements: jsonb("requirements").default([]),
    wishes: jsonb("wishes").default([]),
    competences: jsonb("competences").default([]),
    conditions: jsonb("conditions").default([]),

    // === Metadata ===
    scrapedAt: timestamp("scraped_at").defaultNow(),
    deletedAt: timestamp("deleted_at"), // PRD 7.2: soft-delete
    rawPayload: jsonb("raw_payload"),
    embedding: text("embedding"), // pgvector placeholder (Slice 5)
  },
  (table) => ({
    platformExternalIdx: uniqueIndex("uq_platform_external_id").on(
      table.platform,
      table.externalId,
    ),
    titleBtreeIdx: index("idx_jobs_title_btree").on(table.title),
    platformIdx: index("idx_jobs_platform").on(table.platform),
    scrapedAtIdx: index("idx_jobs_scraped_at").on(table.scrapedAt),
    deletedAtIdx: index("idx_jobs_deleted_at").on(table.deletedAt),
    deadlineIdx: index("idx_jobs_deadline").on(table.applicationDeadline),
    platformUrlIdx: uniqueIndex("uq_platform_external_url").on(
      table.platform,
      table.externalUrl,
    ),
  }),
);
