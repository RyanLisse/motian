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
} from "drizzle-orm/pg-core";

const vector = customType<{ data: string; driverParam: string; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 512})`;
  },
  toDriver(value: string) {
    return value;
  },
  fromDriver(value: unknown) {
    return value as string;
  },
});

// ========== Scraper Configuratie ==========
export const platformCatalog = pgTable("platform_catalog", {
  slug: text("slug").primaryKey(),
  displayName: text("display_name").notNull(),
  adapterKind: text("adapter_kind").notNull(),
  authMode: text("auth_mode").notNull(),
  attributionLabel: text("attribution_label").notNull(),
  description: text("description").default(""),
  capabilities: jsonb("capabilities").default([]),
  docsUrl: text("docs_url"),
  defaultBaseUrl: text("default_base_url"),
  configSchema: jsonb("config_schema").default({}),
  authSchema: jsonb("auth_schema").default({}),
  isEnabled: boolean("is_enabled").notNull().default(true),
  isSelfServe: boolean("is_self_serve").notNull().default(true),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
});

export const scraperConfigs = pgTable(
  "scraper_configs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    platform: text("platform").notNull(),
    baseUrl: text("base_url").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    parameters: jsonb("parameters").default({}),
    authConfigEncrypted: text("auth_config_encrypted"),
    credentialsRef: text("credentials_ref"),
    cronExpression: text("cron_expression").default("0 0 */4 * * *"),
    validationStatus: text("validation_status").default("unknown"),
    lastValidatedAt: timestamp("last_validated_at"),
    lastValidationError: text("last_validation_error"),
    lastTestImportAt: timestamp("last_test_import_at"),
    lastTestImportStatus: text("last_test_import_status"),
    lastRunAt: timestamp("last_run_at"),
    lastRunStatus: text("last_run_status"),
    consecutiveFailures: integer("consecutive_failures").default(0),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    platformUniqueIdx: uniqueIndex("uq_scraper_configs_platform").on(table.platform),
  }),
);

// ========== Scrape Resultaten ==========
export const scrapeResults = pgTable(
  "scrape_results",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    configId: text("config_id").references(() => scraperConfigs.id, {
      onDelete: "set null",
    }),
    platform: text("platform").notNull(),
    runAt: timestamp("run_at").$defaultFn(() => new Date()),
    durationMs: integer("duration_ms"),
    jobsFound: integer("jobs_found").default(0),
    jobsNew: integer("jobs_new").default(0),
    duplicates: integer("duplicates").default(0),
    status: text("status").notNull(),
    errors: jsonb("errors").default([]),
    jobIds: jsonb("job_ids"),
  },
  (table) => ({
    configIdIdx: index("idx_scrape_results_config_id").on(table.configId),
    runAtIdx: index("idx_scrape_results_run_at").on(table.runAt),
    platformIdx: index("idx_scrape_results_platform").on(table.platform),
  }),
);

// ========== Platform Onboarding Runs ==========
export const platformOnboardingRuns = pgTable(
  "platform_onboarding_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    platformSlug: text("platform_slug")
      .notNull()
      .references(() => platformCatalog.slug, { onDelete: "cascade" }),
    configId: text("config_id").references(() => scraperConfigs.id, {
      onDelete: "set null",
    }),
    source: text("source").notNull().default("ui"),
    status: text("status").notNull().default("draft"),
    currentStep: text("current_step").notNull().default("create_draft"),
    blockerKind: text("blocker_kind"),
    nextActions: jsonb("next_actions").default([]),
    evidence: jsonb("evidence").default({}),
    result: jsonb("result").default({}),
    startedAt: timestamp("started_at").$defaultFn(() => new Date()),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    platformSlugIdx: index("idx_platform_onboarding_runs_platform_slug").on(table.platformSlug),
    configIdIdx: index("idx_platform_onboarding_runs_config_id").on(table.configId),
    updatedAtIdx: index("idx_platform_onboarding_runs_updated_at").on(table.updatedAt),
    latestPerPlatformIdx: index("idx_platform_onboarding_runs_platform_slug_updated_at").on(
      table.platformSlug,
      table.updatedAt,
    ),
  }),
);

// ========== Opdrachten ==========
export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    platform: text("platform").notNull(),
    externalId: text("external_id").notNull(),
    externalUrl: text("external_url"),
    clientReferenceCode: text("client_reference_code"),
    title: text("title").notNull(),
    company: text("company"),
    endClient: text("end_client"),
    contractLabel: text("contract_label"),
    location: text("location"),
    province: text("province"),
    description: text("description"),
    dedupeTitleNormalized: text("dedupe_title_normalized").notNull().default(""),
    dedupeClientNormalized: text("dedupe_client_normalized").notNull().default(""),
    dedupeLocationNormalized: text("dedupe_location_normalized").notNull().default(""),
    searchText: text("search_text").notNull().default(""),
    status: text("status").notNull().default("open"),
    archivedAt: timestamp("archived_at"),
    rateMin: integer("rate_min"),
    rateMax: integer("rate_max"),
    currency: text("currency").default("EUR"),
    positionsAvailable: integer("positions_available").default(1),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    applicationDeadline: timestamp("application_deadline"),
    postedAt: timestamp("posted_at"),
    contractType: text("contract_type"),
    workArrangement: text("work_arrangement"),
    allowsSubcontracting: boolean("allows_subcontracting"),
    requirements: jsonb("requirements").default([]),
    wishes: jsonb("wishes").default([]),
    competences: jsonb("competences").default([]),
    conditions: jsonb("conditions").default([]),
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
    latitude: real("latitude"),
    longitude: real("longitude"),
    postcode: text("postcode"),
    companyLogoUrl: text("company_logo_url"),
    educationLevel: text("education_level"),
    durationMonths: integer("duration_months"),
    sourceUrl: text("source_url"),
    sourcePlatform: text("source_platform"),
    categories: jsonb("categories").default([]),
    companyAddress: text("company_address"),
    scrapedAt: timestamp("scraped_at").$defaultFn(() => new Date()),
    deletedAt: timestamp("deleted_at"),
    rawPayload: jsonb("raw_payload"),
    embedding: vector("embedding", { dimensions: 512 }),
    // Precomputed tsvector for full-text search (managed by DB trigger, not Drizzle)
    searchVector: text("search_vector"),
  },
  (table) => ({
    platformExternalIdx: uniqueIndex("uq_platform_external_id").on(
      table.platform,
      table.externalId,
    ),
    titleBtreeIdx: index("idx_jobs_title").on(table.title),
    platformIdx: index("idx_jobs_platform").on(table.platform),
    archivedAtIdx: index("idx_jobs_archived_at").on(table.archivedAt),
    scrapedAtIdx: index("idx_jobs_scraped_at").on(table.scrapedAt),
    deletedAtIdx: index("idx_jobs_deleted_at").on(table.deletedAt),
    deadlineIdx: index("idx_jobs_deadline").on(table.applicationDeadline),
    dedupePartitionIdx: index("idx_jobs_dedupe_partition").on(
      table.dedupeTitleNormalized,
      table.dedupeClientNormalized,
      table.dedupeLocationNormalized,
      table.scrapedAt,
      table.id,
    ),
    platformUrlIdx: index("idx_platform_external_url").on(table.platform, table.externalUrl),
    provinceIdx: index("idx_jobs_province").on(table.province),
    contractTypeIdx: index("idx_jobs_contract_type").on(table.contractType),
    workArrangementIdx: index("idx_jobs_work_arrangement").on(table.workArrangement),
    postedAtIdx: index("idx_jobs_posted_at").on(table.postedAt),
    startDateIdx: index("idx_jobs_start_date").on(table.startDate),
    rateRangeIdx: index("idx_jobs_rate_range").on(table.rateMin, table.rateMax),
    statusIdx: index("idx_jobs_status").on(table.status),
    hoursIdx: index("idx_jobs_hours").on(table.minHoursPerWeek, table.hoursPerWeek),
    statusPlatformIdx: index("idx_jobs_status_platform").on(table.status, table.platform),
    statusProvinceIdx: index("idx_jobs_status_province").on(table.status, table.province),
    statusScrapedAtIdx: index("idx_jobs_status_scraped_at").on(table.status, table.scrapedAt),
    statusDeletedAtIdx: index("idx_jobs_status_deleted_at").on(table.status, table.deletedAt),
    openActiveIdx: index("idx_jobs_open_active").on(table.status, table.scrapedAt).where(sql`deleted_at IS NULL AND status = 'open'`),
    platformActiveIdx: index("idx_jobs_platform_active").on(table.platform, table.scrapedAt).where(sql`deleted_at IS NULL`),
    visibleEndClientIdx: index("idx_jobs_visible_end_client").on(table.status, table.endClient, table.company).where(sql`deleted_at IS NULL AND status <> 'archived'`),
    // GIN indexes managed via SQL (Drizzle lacks native GIN/tsvector support):
    // - idx_jobs_search_vector: GIN on search_vector tsvector column (full-text search)
    // - idx_jobs_title_trgm: GIN with gin_trgm_ops on title (fuzzy matching)
    // - idx_jobs_search_text_trgm: GIN with gin_trgm_ops on search_text (fuzzy search)
    // Trigger: jobs_search_vector_trigger auto-updates search_vector on search_text changes
  }),
);

// ========== Kandidaten ==========
export const candidates = pgTable(
  "candidates",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    role: text("role"),
    location: text("location"),
    province: text("province"),
    skills: jsonb("skills").default([]),
    experience: jsonb("experience").default([]),
    preferences: jsonb("preferences").default({}),
    resumeUrl: text("resume_url"),
    linkedinUrl: text("linkedin_url"),
    headline: text("headline"),
    profileSummary: text("profile_summary"),
    source: text("source"),
    notes: text("notes"),
    hourlyRate: integer("hourly_rate"),
    availability: text("availability"),
    resumeRaw: text("resume_raw"),
    resumeParsedAt: timestamp("resume_parsed_at"),
    matchingStatus: text("matching_status").notNull().default("open"),
    lastMatchedAt: timestamp("last_matched_at"),
    matchingStatusUpdatedAt: timestamp("matching_status_updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
    skillsStructured: jsonb("skills_structured"),
    education: jsonb("education"),
    certifications: jsonb("certifications"),
    languageSkills: jsonb("language_skills"),
    consentGranted: boolean("consent_granted").default(false),
    dataRetentionUntil: timestamp("data_retention_until"),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
    deletedAt: timestamp("deleted_at"),
    embedding: vector("embedding", { dimensions: 512 }),
  },
  (table) => ({
    emailUniqueIdx: uniqueIndex("uq_candidates_email")
      .on(table.email)
      .where(sql`email IS NOT NULL`),
    matchingStatusIdx: index("idx_candidates_matching_status").on(table.matchingStatus),
    lastMatchedAtIdx: index("idx_candidates_last_matched_at").on(table.lastMatchedAt),
    nameIdx: index("idx_candidates_name").on(table.name),
    provinceIdx: index("idx_candidates_province").on(table.province),
    deletedAtIdx: index("idx_candidates_deleted_at").on(table.deletedAt),
  }),
);

// ========== ESCO Canonical Skills ==========
export const escoSkills = pgTable(
  "esco_skills",
  {
    uri: text("uri").primaryKey(),
    preferredLabelEn: text("preferred_label_en").notNull(),
    preferredLabelNl: text("preferred_label_nl"),
    skillType: text("skill_type"),
    reuseLevel: text("reuse_level"),
    broaderUri: text("broader_uri"),
    escoVersion: text("esco_version").notNull(),
    rawConcept: jsonb("raw_concept").default({}),
    importedAt: timestamp("imported_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    preferredLabelEnIdx: index("idx_esco_skills_preferred_label_en").on(table.preferredLabelEn),
    preferredLabelNlIdx: index("idx_esco_skills_preferred_label_nl").on(table.preferredLabelNl),
    broaderUriIdx: index("idx_esco_skills_broader_uri").on(table.broaderUri),
  }),
);

export const skillAliases = pgTable(
  "skill_aliases",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
    language: text("language"),
    source: text("source").notNull(),
    confidence: real("confidence"),
    escoUri: text("esco_uri")
      .notNull()
      .references(() => escoSkills.uri, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    normalizedAliasIdx: index("idx_skill_aliases_normalized_alias").on(table.normalizedAlias),
    escoUriIdx: index("idx_skill_aliases_esco_uri").on(table.escoUri),
    aliasLanguageUniqueIdx: uniqueIndex("uq_skill_aliases_alias_language_esco").on(
      table.normalizedAlias,
      table.language,
      table.escoUri,
    ),
  }),
);

export const candidateSkills = pgTable(
  "candidate_skills",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    escoUri: text("esco_uri")
      .notNull()
      .references(() => escoSkills.uri, { onDelete: "restrict" }),
    source: text("source").notNull(),
    confidence: real("confidence"),
    confidenceHint: text("confidence_hint"),
    evidence: text("evidence"),
    critical: boolean("critical").notNull().default(false),
    mappingStrategy: text("mapping_strategy"),
    escoVersion: text("esco_version"),
    mappedAt: timestamp("mapped_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    candidateIdIdx: index("idx_candidate_skills_candidate_id").on(table.candidateId),
    escoUriIdx: index("idx_candidate_skills_esco_uri").on(table.escoUri),
    candidateSkillUniqueIdx: uniqueIndex("uq_candidate_skills_candidate_esco_source").on(
      table.candidateId,
      table.escoUri,
      table.source,
    ),
  }),
);

export const jobSkills = pgTable(
  "job_skills",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    escoUri: text("esco_uri")
      .notNull()
      .references(() => escoSkills.uri, { onDelete: "restrict" }),
    source: text("source").notNull(),
    confidence: real("confidence"),
    confidenceHint: text("confidence_hint"),
    evidence: text("evidence"),
    required: boolean("required").notNull().default(false),
    critical: boolean("critical").notNull().default(false),
    weight: real("weight"),
    mappingStrategy: text("mapping_strategy"),
    escoVersion: text("esco_version"),
    mappedAt: timestamp("mapped_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    jobIdIdx: index("idx_job_skills_job_id").on(table.jobId),
    escoUriIdx: index("idx_job_skills_esco_uri").on(table.escoUri),
    jobSkillUniqueIdx: uniqueIndex("uq_job_skills_job_esco_source").on(
      table.jobId,
      table.escoUri,
      table.source,
    ),
    criticalIdx: index("idx_job_skills_critical").on(table.critical),
    escoJobIdx: index("idx_job_skills_esco_job").on(table.escoUri, table.jobId),
  }),
);

export const skillMappings = pgTable(
  "skill_mappings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    rawSkill: text("raw_skill").notNull(),
    normalizedSkill: text("normalized_skill").notNull(),
    escoUri: text("esco_uri").references(() => escoSkills.uri, { onDelete: "set null" }),
    contextType: text("context_type").notNull(),
    contextId: text("context_id").notNull(),
    source: text("source").notNull(),
    strategy: text("strategy").notNull(),
    confidence: real("confidence"),
    evidence: text("evidence"),
    critical: boolean("critical").notNull().default(false),
    sentToReview: boolean("sent_to_review").notNull().default(false),
    reviewStatus: text("review_status"),
    escoVersion: text("esco_version"),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    normalizedSkillIdx: index("idx_skill_mappings_normalized_skill").on(table.normalizedSkill),
    contextIdx: index("idx_skill_mappings_context").on(table.contextType, table.contextId),
    escoUriIdx: index("idx_skill_mappings_esco_uri").on(table.escoUri),
    reviewQueueIdx: index("idx_skill_mappings_review_queue").on(
      table.sentToReview,
      table.reviewStatus,
    ),
  }),
);

// ========== Job Matches ==========
export const jobMatches = pgTable(
  "job_matches",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    candidateId: text("candidate_id").references(() => candidates.id, {
      onDelete: "set null",
    }),
    matchScore: real("match_score").notNull(),
    confidence: real("confidence"),
    reasoning: text("reasoning"),
    model: text("model"),
    promptVersion: text("prompt_version"),
    status: text("status").notNull().default("pending"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at"),
    criteriaBreakdown: jsonb("criteria_breakdown"),
    riskProfile: jsonb("risk_profile"),
    enrichmentSuggestions: jsonb("enrichment_suggestions"),
    recommendation: text("recommendation"),
    recommendationConfidence: real("recommendation_confidence"),
    assessmentModel: text("assessment_model"),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
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

// ========== Sollicitaties ==========
export const applications = pgTable(
  "applications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    candidateId: text("candidate_id").references(() => candidates.id, { onDelete: "set null" }),
    matchId: text("match_id").references(() => jobMatches.id, { onDelete: "set null" }),
    stage: text("stage").notNull().default("new"),
    source: text("source").default("manual"),
    notes: text("notes"),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    jobIdIdx: index("idx_applications_job_id").on(table.jobId),
    candidateIdIdx: index("idx_applications_candidate_id").on(table.candidateId),
    stageIdx: index("idx_applications_stage").on(table.stage),
    jobCandidateUniqueIdx: uniqueIndex("uq_applications_job_candidate_active")
      .on(table.jobId, table.candidateId)
      .where(sql`deleted_at IS NULL`),
    jobActiveIdx: index("idx_applications_job_active").on(table.jobId).where(sql`deleted_at IS NULL`),
  }),
);

// ========== Interviews ==========
export const interviews = pgTable(
  "interviews",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    applicationId: text("application_id")
      .references(() => applications.id, { onDelete: "cascade" })
      .notNull(),
    scheduledAt: timestamp("scheduled_at").notNull(),
    duration: integer("duration").default(60),
    type: text("type").notNull(),
    interviewer: text("interviewer").notNull(),
    location: text("location"),
    status: text("status").notNull().default("scheduled"),
    feedback: text("feedback"),
    rating: integer("rating"),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    applicationIdIdx: index("idx_interviews_application_id").on(table.applicationId),
    scheduledAtIdx: index("idx_interviews_scheduled_at").on(table.scheduledAt),
    statusIdx: index("idx_interviews_status").on(table.status),
    deletedAtIdx: index("idx_interviews_deleted_at").on(table.deletedAt),
  }),
);

// ========== Sidebar Metadata (precomputed) ==========
export const sidebarMetadata = pgTable("sidebar_metadata", {
  id: text("id").primaryKey().default("default"),
  totalCount: integer("total_count").notNull().default(0),
  platforms: jsonb("platforms").notNull().default([]),
  endClients: jsonb("end_clients").notNull().default([]),
  categories: jsonb("categories").notNull().default([]),
  skillOptions: jsonb("skill_options").notNull().default([]),
  skillEmptyText: text("skill_empty_text").notNull().default("Geen vaardigheden gevonden."),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});

// ========== Job Dedupe Ranks (precomputed) ==========
export const jobDedupeRanks = pgTable("job_dedupe_ranks", {
  jobId: text("job_id")
    .primaryKey()
    .references(() => jobs.id, { onDelete: "cascade" }),
  dedupeRank: integer("dedupe_rank").notNull(),
  dedupeGroup: text("dedupe_group").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});

// ========== GDPR Audit Log ==========
export const gdprAuditLog = pgTable(
  "gdpr_audit_log",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    action: text("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    requestedBy: text("requested_by").notNull(),
    reason: text("reason"),
    details: jsonb("details").default({}),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    subjectIdx: index("idx_gdpr_audit_subject").on(table.subjectType, table.subjectId),
    actionIdx: index("idx_gdpr_audit_action").on(table.action),
    createdAtIdx: index("idx_gdpr_audit_created_at").on(table.createdAt),
  }),
);

// ========== Chat Sessies ==========
export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id").notNull(),
    messages: jsonb("messages").notNull().default([]),
    context: jsonb("context").default({}),
    messageCount: integer("message_count").default(0),
    title: text("title"),
    lastMessagePreview: text("last_message_preview"),
    tokensUsed: integer("tokens_used").default(0),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    sessionIdUniqueIdx: uniqueIndex("uq_chat_sessions_session_id").on(table.sessionId),
    updatedAtIdx: index("idx_chat_sessions_updated_at").on(table.updatedAt),
  }),
);

export const chatSessionMessages = pgTable(
  "chat_session_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id").notNull(),
    messageId: text("message_id").notNull(),
    role: text("role").notNull(),
    message: jsonb("message").notNull(),
    orderIndex: integer("order_index").notNull(),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    sessionMessageUniqueIdx: uniqueIndex("uq_chat_session_messages_session_message_id").on(
      table.sessionId,
      table.messageId,
    ),
    sessionOrderUniqueIdx: uniqueIndex("uq_chat_session_messages_session_order_index").on(
      table.sessionId,
      table.orderIndex,
    ),
    sessionOrderIdx: index("idx_chat_session_messages_session_order").on(
      table.sessionId,
      table.orderIndex,
    ),
  }),
);

// ========== Berichten ==========
export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    applicationId: text("application_id")
      .references(() => applications.id, { onDelete: "cascade" })
      .notNull(),
    direction: text("direction").notNull(),
    channel: text("channel").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at").$defaultFn(() => new Date()),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    applicationIdIdx: index("idx_messages_application_id").on(table.applicationId),
    directionIdx: index("idx_messages_direction").on(table.direction),
    deletedAtIdx: index("idx_messages_deleted_at").on(table.deletedAt),
  }),
);

// ========== Screening Calls ==========
export const screeningCalls = pgTable(
  "screening_calls",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    matchId: text("match_id").references(() => jobMatches.id, { onDelete: "set null" }),
    applicationId: text("application_id").references(() => applications.id, { onDelete: "set null" }),
    // LiveKit room details
    roomName: text("room_name").notNull(),
    roomToken: text("room_token"),
    // Call state
    status: text("status").notNull().default("pending"), // pending, ringing, active, completed, failed, cancelled
    initiatedBy: text("initiated_by").default("recruiter"), // recruiter, ai_agent
    // Screening context
    screeningQuestions: jsonb("screening_questions").default([]), // Array of { question, category, aiGenerated, answer?, sentiment? }
    candidateContext: jsonb("candidate_context").default({}), // Snapshot of candidate data at call time
    jobContext: jsonb("job_context").default({}), // Snapshot of job data at call time
    matchContext: jsonb("match_context").default({}), // Match score, reasoning, criteria
    // Results
    transcript: jsonb("transcript").default([]), // Array of { speaker, text, timestamp }
    callSummary: text("call_summary"),
    callNotes: text("call_notes"),
    callDurationSeconds: integer("call_duration_seconds"),
    candidateSentiment: text("candidate_sentiment"), // positive, neutral, negative
    recommendedNextStep: text("recommended_next_step"), // proceed, reject, follow_up
    // Timestamps
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    candidateIdIdx: index("idx_screening_calls_candidate_id").on(table.candidateId),
    jobIdIdx: index("idx_screening_calls_job_id").on(table.jobId),
    statusIdx: index("idx_screening_calls_status").on(table.status),
    createdAtIdx: index("idx_screening_calls_created_at").on(table.createdAt),
    roomNameIdx: uniqueIndex("uq_screening_calls_room_name").on(table.roomName),
  }),
);

// ========== Platform Instellingen ==========
export const platformSettings = pgTable(
  "platform_settings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    category: text("category").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    description: text("description"),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    categoryKeyUniqueIdx: uniqueIndex("uq_platform_settings_category_key").on(
      table.category,
      table.key,
    ),
    categoryIdx: index("idx_platform_settings_category").on(table.category),
  }),
);

// ========== Autopilot Runs ==========
export const autopilotRuns = pgTable(
  "autopilot_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id").notNull().unique(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
    commitSha: text("commit_sha").notNull(),
    totalJourneys: integer("total_journeys").notNull().default(0),
    passedJourneys: integer("passed_journeys").notNull().default(0),
    failedJourneys: integer("failed_journeys").notNull().default(0),
    totalFindings: integer("total_findings").notNull().default(0),
    findingsBySeverity: jsonb("findings_by_severity").default({}),
    findingsByCategory: jsonb("findings_by_category").default({}),
    reportUrl: text("report_url"),
    triggerRunId: text("trigger_run_id"),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    runIdUniqueIdx: uniqueIndex("uq_autopilot_runs_run_id").on(table.runId),
    statusIdx: index("idx_autopilot_runs_status").on(table.status),
    startedAtIdx: index("idx_autopilot_runs_started_at").on(table.startedAt),
  }),
);

// ========== Autopilot Findings ==========
export const autopilotFindings = pgTable(
  "autopilot_findings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    findingId: text("finding_id").notNull(),
    runId: text("run_id").notNull().references(() => autopilotRuns.runId, { onDelete: "cascade" }),
    category: text("category").notNull(),
    surface: text("surface").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    severity: text("severity").notNull(),
    confidence: real("confidence").notNull(),
    autoFixable: boolean("auto_fixable").notNull().default(false),
    status: text("status").notNull().default("detected"),
    fingerprint: text("fingerprint").notNull(),
    suspectedRootCause: text("suspected_root_cause"),
    recommendedAction: text("recommended_action"),
    githubIssueNumber: integer("github_issue_number"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    findingIdUniqueIdx: uniqueIndex("uq_autopilot_findings_finding_id").on(table.findingId),
    runIdIdx: index("idx_autopilot_findings_run_id").on(table.runId),
    fingerprintIdx: index("idx_autopilot_findings_fingerprint").on(table.fingerprint),
    severityIdx: index("idx_autopilot_findings_severity").on(table.severity),
    statusIdx: index("idx_autopilot_findings_status").on(table.status),
  }),
);

// ========== Agent Events (persistent event bus) ==========
export const agentEvents = pgTable(
  "agent_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    // Which agent emitted this event
    sourceAgent: text("source_agent").notNull(), // intake, matcher, screener, scheduler, sourcing, communicator
    // What happened
    eventType: text("event_type").notNull(), // e.g. candidate.parsed, match.created, screening.requested
    // Entity references (nullable — not all events have all refs)
    candidateId: text("candidate_id").references(() => candidates.id, { onDelete: "set null" }),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    matchId: text("match_id").references(() => jobMatches.id, { onDelete: "set null" }),
    screeningCallId: text("screening_call_id").references(() => screeningCalls.id, {
      onDelete: "set null",
    }),
    // Event payload — arbitrary structured data
    payload: jsonb("payload").default({}),
    // Processing state for downstream consumers
    status: text("status").notNull().default("pending"), // pending, processing, completed, failed
    processedBy: text("processed_by"), // which agent picked this up
    processedAt: timestamp("processed_at"),
    errorMessage: text("error_message"),
    // Trigger.dev run reference for traceability
    triggerRunId: text("trigger_run_id"),
    // Timestamps
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  },
  (table) => ({
    sourceAgentIdx: index("idx_agent_events_source_agent").on(table.sourceAgent),
    eventTypeIdx: index("idx_agent_events_event_type").on(table.eventType),
    statusIdx: index("idx_agent_events_status").on(table.status),
    candidateIdx: index("idx_agent_events_candidate_id").on(table.candidateId),
    jobIdx: index("idx_agent_events_job_id").on(table.jobId),
    createdAtIdx: index("idx_agent_events_created_at").on(table.createdAt),
    // Composite: find pending events for a specific type efficiently
    pendingByTypeIdx: index("idx_agent_events_pending_type").on(table.status, table.eventType),
  }),
);
