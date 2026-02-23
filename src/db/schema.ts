import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// pgvector custom column type for Drizzle
const vector = customType<{
  data: number[];
  driverParam: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 512})`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === "string") {
      return value.replace(/^\[/, "").replace(/\]$/, "").split(",").map(Number);
    }
    return value as number[];
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
});

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
    platformUniqueIdx: uniqueIndex("uq_scraper_configs_platform").on(table.platform),
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
    platform: text("platform").notNull(), // "striive", "indeed", "linkedin", "opdrachtoverheid", "flextender"
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

    // === Verrijkte Data ===
    hoursPerWeek: integer("hours_per_week"),
    minHoursPerWeek: integer("min_hours_per_week"),
    extensionPossible: boolean("extension_possible"),
    countryCode: text("country_code"),
    remunerationType: text("remuneration_type"),
    workExperienceYears: integer("work_experience_years"),
    numberOfViews: integer("number_of_views"),
    attachments: jsonb("attachments").default([]),
    questions: jsonb("questions").default([]),
    languages: jsonb("languages").default([]),
    descriptionSummary: jsonb("description_summary"),
    faqAnswers: jsonb("faq_answers").default([]),
    agentContact: jsonb("agent_contact"),
    recruiterContact: jsonb("recruiter_contact"),

    // === Locatie & Organisatie ===
    latitude: real("latitude"),
    longitude: real("longitude"),
    postcode: text("postcode"),
    companyLogoUrl: text("company_logo_url"),

    // === Opdracht Kenmerken ===
    educationLevel: text("education_level"),
    durationMonths: integer("duration_months"),
    sourceUrl: text("source_url"),
    sourcePlatform: text("source_platform"),
    categories: jsonb("categories").default([]),
    companyAddress: text("company_address"),

    // === Metadata ===
    scrapedAt: timestamp("scraped_at").defaultNow(),
    deletedAt: timestamp("deleted_at"), // PRD 7.2: soft-delete
    rawPayload: jsonb("raw_payload"),
    embedding: vector("embedding", { dimensions: 512 }),
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
    platformUrlIdx: index("idx_platform_external_url").on(table.platform, table.externalUrl),
  }),
);

// ========== Kandidaten ==========
export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    role: text("role"), // gewenste functie
    location: text("location"),
    province: text("province"),
    skills: jsonb("skills").default([]),
    experience: jsonb("experience").default([]),
    preferences: jsonb("preferences").default({}),
    resumeUrl: text("resume_url"),
    source: text("source"), // "linkedin", "manual", "import", "mcp"
    notes: text("notes"),
    hourlyRate: integer("hourly_rate"),
    availability: text("availability"), // "direct", "1_maand", "3_maanden"
    embedding: vector("embedding", { dimensions: 512 }),
    consentGranted: boolean("consent_granted").default(false),
    dataRetentionUntil: timestamp("data_retention_until"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    emailUniqueIdx: uniqueIndex("uq_candidates_email")
      .on(table.email)
      .where(sql`email IS NOT NULL`),
    nameIdx: index("idx_candidates_name").on(table.name),
    provinceIdx: index("idx_candidates_province").on(table.province),
    deletedAtIdx: index("idx_candidates_deleted_at").on(table.deletedAt),
  }),
);

// ========== Job Matches ==========
export const jobMatches = pgTable(
  "job_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    candidateId: uuid("candidate_id").references(() => candidates.id, {
      onDelete: "set null",
    }),
    matchScore: real("match_score").notNull(), // 0-100
    confidence: real("confidence"), // 0-100
    reasoning: text("reasoning"),
    model: text("model"), // "gpt-4o", etc.
    promptVersion: text("prompt_version"),
    status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected"
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    jobIdIdx: index("idx_job_matches_job_id").on(table.jobId),
    candidateIdIdx: index("idx_job_matches_candidate_id").on(table.candidateId),
    statusIdx: index("idx_job_matches_status").on(table.status),
    jobCandidateUniqueIdx: uniqueIndex("uq_job_matches_job_candidate").on(
      table.jobId,
      table.candidateId,
    ),
  }),
);

// ========== Sollicitaties (Applications) ==========
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "set null" }),
    matchId: uuid("match_id").references(() => jobMatches.id, { onDelete: "set null" }),
    stage: text("stage").notNull().default("new"), // "new" | "screening" | "interview" | "offer" | "hired" | "rejected"
    source: text("source").default("manual"), // "match" | "manual" | "import"
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    jobIdIdx: index("idx_applications_job_id").on(table.jobId),
    candidateIdIdx: index("idx_applications_candidate_id").on(table.candidateId),
    stageIdx: index("idx_applications_stage").on(table.stage),
    jobCandidateUniqueIdx: uniqueIndex("uq_applications_job_candidate").on(
      table.jobId,
      table.candidateId,
    ),
  }),
);

// ========== Interviews ==========
export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .references(() => applications.id, { onDelete: "cascade" })
      .notNull(),
    scheduledAt: timestamp("scheduled_at").notNull(),
    duration: integer("duration").default(60), // minuten
    type: text("type").notNull(), // "phone" | "video" | "onsite" | "technical"
    interviewer: text("interviewer").notNull(),
    location: text("location"),
    status: text("status").notNull().default("scheduled"), // "scheduled" | "completed" | "cancelled"
    feedback: text("feedback"),
    rating: integer("rating"), // 1-5
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    applicationIdIdx: index("idx_interviews_application_id").on(table.applicationId),
    scheduledAtIdx: index("idx_interviews_scheduled_at").on(table.scheduledAt),
    statusIdx: index("idx_interviews_status").on(table.status),
  }),
);

// ========== Berichten (Messages) ==========
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .references(() => applications.id, { onDelete: "cascade" })
      .notNull(),
    direction: text("direction").notNull(), // "inbound" | "outbound"
    channel: text("channel").notNull(), // "email" | "phone" | "platform"
    subject: text("subject"),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at").defaultNow(),
  },
  (table) => ({
    applicationIdIdx: index("idx_messages_application_id").on(table.applicationId),
    directionIdx: index("idx_messages_direction").on(table.direction),
  }),
);
