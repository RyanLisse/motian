import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ========== Scraper Configuratie ==========
export const platformCatalog = sqliteTable("platform_catalog", {
  slug: text("slug").primaryKey(),
  displayName: text("display_name").notNull(),
  adapterKind: text("adapter_kind").notNull(),
  authMode: text("auth_mode").notNull(),
  attributionLabel: text("attribution_label").notNull(),
  description: text("description").default(""),
  capabilities: text("capabilities", { mode: "json" }).default(JSON.stringify([])),
  docsUrl: text("docs_url"),
  defaultBaseUrl: text("default_base_url"),
  configSchema: text("config_schema", { mode: "json" }).default(JSON.stringify({})),
  authSchema: text("auth_schema", { mode: "json" }).default(JSON.stringify({})),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  isSelfServe: integer("is_self_serve", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const scraperConfigs = sqliteTable(
  "scraper_configs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    platform: text("platform").notNull(),
    baseUrl: text("base_url").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    parameters: text("parameters", { mode: "json" }).default({}),
    authConfigEncrypted: text("auth_config_encrypted"),
    credentialsRef: text("credentials_ref"),
    cronExpression: text("cron_expression").default("0 0 */4 * * *"),
    validationStatus: text("validation_status").default("unknown"),
    lastValidatedAt: integer("last_validated_at", { mode: "timestamp" }),
    lastValidationError: text("last_validation_error"),
    lastTestImportAt: integer("last_test_import_at", { mode: "timestamp" }),
    lastTestImportStatus: text("last_test_import_status"),
    lastRunAt: integer("last_run_at", { mode: "timestamp" }),
    lastRunStatus: text("last_run_status"),
    consecutiveFailures: integer("consecutive_failures").default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    platformUniqueIdx: uniqueIndex("uq_scraper_configs_platform").on(table.platform),
  }),
);

// ========== Scrape Resultaten ==========
export const scrapeResults = sqliteTable(
  "scrape_results",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    configId: text("config_id").references(() => scraperConfigs.id, {
      onDelete: "set null",
    }),
    platform: text("platform").notNull(),
    runAt: integer("run_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    durationMs: integer("duration_ms"),
    jobsFound: integer("jobs_found").default(0),
    jobsNew: integer("jobs_new").default(0),
    duplicates: integer("duplicates").default(0),
    status: text("status").notNull(),
    errors: text("errors", { mode: "json" }).default([]),
    jobIds: text("job_ids", { mode: "json" }),
  },
  (table) => ({
    configIdIdx: index("idx_scrape_results_config_id").on(table.configId),
    runAtIdx: index("idx_scrape_results_run_at").on(table.runAt),
    platformIdx: index("idx_scrape_results_platform").on(table.platform),
  }),
);

// ========== Platform Onboarding Runs ==========
export const platformOnboardingRuns = sqliteTable(
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
    nextActions: text("next_actions", { mode: "json" }).default([]),
    evidence: text("evidence", { mode: "json" }).default({}),
    result: text("result", { mode: "json" }).default({}),
    startedAt: integer("started_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
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
export const jobs = sqliteTable(
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
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    rateMin: integer("rate_min"),
    rateMax: integer("rate_max"),
    currency: text("currency").default("EUR"),
    positionsAvailable: integer("positions_available").default(1),
    startDate: integer("start_date", { mode: "timestamp" }),
    endDate: integer("end_date", { mode: "timestamp" }),
    applicationDeadline: integer("application_deadline", { mode: "timestamp" }),
    postedAt: integer("posted_at", { mode: "timestamp" }),
    contractType: text("contract_type"),
    workArrangement: text("work_arrangement"),
    allowsSubcontracting: integer("allows_subcontracting", { mode: "boolean" }),
    requirements: text("requirements", { mode: "json" }).default([]),
    wishes: text("wishes", { mode: "json" }).default([]),
    competences: text("competences", { mode: "json" }).default([]),
    conditions: text("conditions", { mode: "json" }).default([]),
    hoursPerWeek: integer("hours_per_week"),
    minHoursPerWeek: integer("min_hours_per_week"),
    extensionPossible: integer("extension_possible", { mode: "boolean" }),
    countryCode: text("country_code"),
    remunerationType: text("remuneration_type"),
    workExperienceYears: integer("work_experience_years"),
    numberOfViews: integer("number_of_views"),
    attachments: text("attachments", { mode: "json" }).default([]),
    questions: text("questions", { mode: "json" }).default([]),
    languages: text("languages", { mode: "json" }).default([]),
    descriptionSummary: text("description_summary", { mode: "json" }),
    faqAnswers: text("faq_answers", { mode: "json" }).default([]),
    agentContact: text("agent_contact", { mode: "json" }),
    recruiterContact: text("recruiter_contact", { mode: "json" }),
    latitude: real("latitude"),
    longitude: real("longitude"),
    postcode: text("postcode"),
    companyLogoUrl: text("company_logo_url"),
    educationLevel: text("education_level"),
    durationMonths: integer("duration_months"),
    sourceUrl: text("source_url"),
    sourcePlatform: text("source_platform"),
    categories: text("categories", { mode: "json" }).default([]),
    companyAddress: text("company_address"),
    scrapedAt: integer("scraped_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    rawPayload: text("raw_payload", { mode: "json" }),
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
  }),
);

// ========== Kandidaten ==========
export const candidates = sqliteTable(
  "candidates",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    role: text("role"),
    location: text("location"),
    province: text("province"),
    skills: text("skills", { mode: "json" }).default([]),
    experience: text("experience", { mode: "json" }).default([]),
    preferences: text("preferences", { mode: "json" }).default({}),
    resumeUrl: text("resume_url"),
    linkedinUrl: text("linkedin_url"),
    headline: text("headline"),
    profileSummary: text("profile_summary"),
    source: text("source"),
    notes: text("notes"),
    hourlyRate: integer("hourly_rate"),
    availability: text("availability"),
    resumeRaw: text("resume_raw"),
    resumeParsedAt: integer("resume_parsed_at", { mode: "timestamp" }),
    matchingStatus: text("matching_status").notNull().default("open"),
    lastMatchedAt: integer("last_matched_at", { mode: "timestamp" }),
    matchingStatusUpdatedAt: integer("matching_status_updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    skillsStructured: text("skills_structured", { mode: "json" }),
    education: text("education", { mode: "json" }),
    certifications: text("certifications", { mode: "json" }),
    languageSkills: text("language_skills", { mode: "json" }),
    consentGranted: integer("consent_granted", { mode: "boolean" }).default(false),
    dataRetentionUntil: integer("data_retention_until", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
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
export const escoSkills = sqliteTable(
  "esco_skills",
  {
    uri: text("uri").primaryKey(),
    preferredLabelEn: text("preferred_label_en").notNull(),
    preferredLabelNl: text("preferred_label_nl"),
    skillType: text("skill_type"),
    reuseLevel: text("reuse_level"),
    broaderUri: text("broader_uri"),
    escoVersion: text("esco_version").notNull(),
    rawConcept: text("raw_concept", { mode: "json" }).default({}),
    importedAt: integer("imported_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    preferredLabelEnIdx: index("idx_esco_skills_preferred_label_en").on(table.preferredLabelEn),
    preferredLabelNlIdx: index("idx_esco_skills_preferred_label_nl").on(table.preferredLabelNl),
    broaderUriIdx: index("idx_esco_skills_broader_uri").on(table.broaderUri),
  }),
);

export const skillAliases = sqliteTable(
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
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
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

export const candidateSkills = sqliteTable(
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
    critical: integer("critical", { mode: "boolean" }).notNull().default(false),
    mappingStrategy: text("mapping_strategy"),
    escoVersion: text("esco_version"),
    mappedAt: integer("mapped_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
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

export const jobSkills = sqliteTable(
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
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    critical: integer("critical", { mode: "boolean" }).notNull().default(false),
    weight: real("weight"),
    mappingStrategy: text("mapping_strategy"),
    escoVersion: text("esco_version"),
    mappedAt: integer("mapped_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
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
  }),
);

export const skillMappings = sqliteTable(
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
    critical: integer("critical", { mode: "boolean" }).notNull().default(false),
    sentToReview: integer("sent_to_review", { mode: "boolean" }).notNull().default(false),
    reviewStatus: text("review_status"),
    escoVersion: text("esco_version"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
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
export const jobMatches = sqliteTable(
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
    reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
    criteriaBreakdown: text("criteria_breakdown", { mode: "json" }),
    riskProfile: text("risk_profile", { mode: "json" }),
    enrichmentSuggestions: text("enrichment_suggestions", { mode: "json" }),
    recommendation: text("recommendation"),
    recommendationConfidence: real("recommendation_confidence"),
    assessmentModel: text("assessment_model"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
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
export const applications = sqliteTable(
  "applications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    candidateId: text("candidate_id").references(() => candidates.id, { onDelete: "set null" }),
    matchId: text("match_id").references(() => jobMatches.id, { onDelete: "set null" }),
    stage: text("stage").notNull().default("new"),
    source: text("source").default("manual"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => ({
    jobIdIdx: index("idx_applications_job_id").on(table.jobId),
    candidateIdIdx: index("idx_applications_candidate_id").on(table.candidateId),
    stageIdx: index("idx_applications_stage").on(table.stage),
    jobCandidateUniqueIdx: uniqueIndex("uq_applications_job_candidate_active")
      .on(table.jobId, table.candidateId)
      .where(sql`deleted_at IS NULL`),
  }),
);

// ========== Interviews ==========
export const interviews = sqliteTable(
  "interviews",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    applicationId: text("application_id")
      .references(() => applications.id, { onDelete: "cascade" })
      .notNull(),
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }).notNull(),
    duration: integer("duration").default(60),
    type: text("type").notNull(),
    interviewer: text("interviewer").notNull(),
    location: text("location"),
    status: text("status").notNull().default("scheduled"),
    feedback: text("feedback"),
    rating: integer("rating"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => ({
    applicationIdIdx: index("idx_interviews_application_id").on(table.applicationId),
    scheduledAtIdx: index("idx_interviews_scheduled_at").on(table.scheduledAt),
    statusIdx: index("idx_interviews_status").on(table.status),
    deletedAtIdx: index("idx_interviews_deleted_at").on(table.deletedAt),
  }),
);

// ========== GDPR Audit Log ==========
export const gdprAuditLog = sqliteTable(
  "gdpr_audit_log",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    action: text("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    requestedBy: text("requested_by").notNull(),
    reason: text("reason"),
    details: text("details", { mode: "json" }).default({}),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    subjectIdx: index("idx_gdpr_audit_subject").on(table.subjectType, table.subjectId),
    actionIdx: index("idx_gdpr_audit_action").on(table.action),
    createdAtIdx: index("idx_gdpr_audit_created_at").on(table.createdAt),
  }),
);

// ========== Chat Sessies ==========
export const chatSessions = sqliteTable(
  "chat_sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id").notNull(),
    messages: text("messages", { mode: "json" }).notNull().default([]),
    context: text("context", { mode: "json" }).default({}),
    messageCount: integer("message_count").default(0),
    title: text("title"),
    lastMessagePreview: text("last_message_preview"),
    tokensUsed: integer("tokens_used").default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    sessionIdUniqueIdx: uniqueIndex("uq_chat_sessions_session_id").on(table.sessionId),
    updatedAtIdx: index("idx_chat_sessions_updated_at").on(table.updatedAt),
  }),
);

export const chatSessionMessages = sqliteTable(
  "chat_session_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id").notNull(),
    messageId: text("message_id").notNull(),
    role: text("role").notNull(),
    message: text("message", { mode: "json" }).notNull(),
    orderIndex: integer("order_index").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
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
export const messages = sqliteTable(
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
    sentAt: integer("sent_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => ({
    applicationIdIdx: index("idx_messages_application_id").on(table.applicationId),
    directionIdx: index("idx_messages_direction").on(table.direction),
    deletedAtIdx: index("idx_messages_deleted_at").on(table.deletedAt),
  }),
);

// ========== Platform Instellingen ==========
export const platformSettings = sqliteTable(
  "platform_settings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    category: text("category").notNull(),
    key: text("key").notNull(),
    value: text("value", { mode: "json" }).notNull(),
    description: text("description"),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
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
export const autopilotRuns = sqliteTable(
  "autopilot_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id").notNull().unique(),
    status: text("status").notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    commitSha: text("commit_sha").notNull(),
    totalJourneys: integer("total_journeys").notNull().default(0),
    passedJourneys: integer("passed_journeys").notNull().default(0),
    failedJourneys: integer("failed_journeys").notNull().default(0),
    totalFindings: integer("total_findings").notNull().default(0),
    findingsBySeverity: text("findings_by_severity", { mode: "json" }).default({}),
    findingsByCategory: text("findings_by_category", { mode: "json" }).default({}),
    reportUrl: text("report_url"),
    triggerRunId: text("trigger_run_id"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    runIdUniqueIdx: uniqueIndex("uq_autopilot_runs_run_id").on(table.runId),
    statusIdx: index("idx_autopilot_runs_status").on(table.status),
    startedAtIdx: index("idx_autopilot_runs_started_at").on(table.startedAt),
  }),
);

// ========== Autopilot Findings ==========
export const autopilotFindings = sqliteTable(
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
    autoFixable: integer("auto_fixable", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("detected"),
    fingerprint: text("fingerprint").notNull(),
    suspectedRootCause: text("suspected_root_cause"),
    recommendedAction: text("recommended_action"),
    githubIssueNumber: integer("github_issue_number"),
    metadata: text("metadata", { mode: "json" }).default({}),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (table) => ({
    findingIdUniqueIdx: uniqueIndex("uq_autopilot_findings_finding_id").on(table.findingId),
    runIdIdx: index("idx_autopilot_findings_run_id").on(table.runId),
    fingerprintIdx: index("idx_autopilot_findings_fingerprint").on(table.fingerprint),
    severityIdx: index("idx_autopilot_findings_severity").on(table.severity),
    statusIdx: index("idx_autopilot_findings_status").on(table.status),
  }),
);
