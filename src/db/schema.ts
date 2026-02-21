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
import { sql } from "drizzle-orm";

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
    embedding: text("embedding"), // Serialized float[] (pgvector when available)
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

// ========== Kandidaten ==========
export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    role: text("role"), // "Senior Java Developer", "DevOps Engineer"
    skills: jsonb("skills").default([]), // ["Java", "Spring Boot", "Kubernetes"]
    experience: text("experience"), // "8 jaar ervaring in backend development"
    location: text("location"),
    province: text("province"),
    resumeUrl: text("resume_url"),
    embedding: text("embedding"), // Serialized float[] for vector search
    tags: jsonb("tags").default([]), // ["beschikbaar", "senior", "remote"]
    gdprConsent: boolean("gdpr_consent").default(false),
    gdprConsentAt: timestamp("gdpr_consent_at"),
    source: text("source"), // "linkedin", "indeed", "cv_upload", "manual"
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    deletedAt: timestamp("deleted_at"), // soft-delete
  },
  (table) => ({
    emailIdx: uniqueIndex("uq_candidates_email")
      .on(table.email)
      .where(sql`${table.email} IS NOT NULL AND ${table.deletedAt} IS NULL`),
    nameIdx: index("idx_candidates_name").on(table.name),
    roleIdx: index("idx_candidates_role").on(table.role),
    deletedAtIdx: index("idx_candidates_deleted_at").on(table.deletedAt),
  }),
);

// ========== Sollicitaties ==========
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    matchId: uuid("match_id").references(() => jobMatches.id, {
      onDelete: "set null",
    }),
    stage: text("stage").notNull().default("new"), // new, screening, interview, offer, hired, rejected
    previousStage: text("previous_stage"),
    stageChangedAt: timestamp("stage_changed_at").defaultNow(),
    notes: text("notes"),
    source: text("source").notNull().default("manual"), // match, manual, import
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    jobIdIdx: index("idx_applications_job_id").on(table.jobId),
    candidateIdIdx: index("idx_applications_candidate_id").on(
      table.candidateId,
    ),
    stageIdx: index("idx_applications_stage").on(table.stage),
    deletedAtIdx: index("idx_applications_deleted_at").on(table.deletedAt),
    jobCandidateUniqueIdx: uniqueIndex("uq_applications_job_candidate")
      .on(table.jobId, table.candidateId)
      .where(sql`${table.deletedAt} IS NULL`),
  }),
);

// ========== Interviews ==========
export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    scheduledAt: timestamp("scheduled_at").notNull(),
    duration: integer("duration").notNull().default(60), // minutes
    type: text("type").notNull(), // phone, video, onsite, technical
    interviewer: text("interviewer").notNull(),
    location: text("location"),
    status: text("status").notNull().default("scheduled"), // scheduled, completed, cancelled
    feedback: text("feedback"),
    rating: integer("rating"), // 1-5
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    applicationIdIdx: index("idx_interviews_application_id").on(
      table.applicationId,
    ),
    scheduledAtIdx: index("idx_interviews_scheduled_at").on(table.scheduledAt),
    statusIdx: index("idx_interviews_status").on(table.status),
  }),
);

// ========== Berichten ==========
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(), // inbound, outbound
    channel: text("channel").notNull(), // email, phone, platform
    subject: text("subject"),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    applicationIdIdx: index("idx_messages_application_id").on(
      table.applicationId,
    ),
    sentAtIdx: index("idx_messages_sent_at").on(table.sentAt),
  }),
);

// ========== Match Resultaten ==========
export const jobMatches = pgTable(
  "job_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    vectorScore: real("vector_score"), // Cosine similarity 0-1
    llmScore: real("llm_score"), // LLM reranking score 0-100
    overallScore: real("overall_score"), // Weighted final score 0-100
    status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected"
    knockOutPassed: boolean("knock_out_passed"),
    matchData: jsonb("match_data").default({}), // Full AI analysis (criteria, skills, etc.)
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    jobCandidateIdx: uniqueIndex("uq_job_matches_job_candidate").on(
      table.jobId,
      table.candidateId,
    ),
    jobIdIdx: index("idx_job_matches_job_id").on(table.jobId),
    candidateIdIdx: index("idx_job_matches_candidate_id").on(table.candidateId),
    statusIdx: index("idx_job_matches_status").on(table.status),
    overallScoreIdx: index("idx_job_matches_overall_score").on(
      table.overallScore,
    ),
  }),
);
