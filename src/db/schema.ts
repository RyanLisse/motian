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
