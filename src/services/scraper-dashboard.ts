import { runs } from "@trigger.dev/sdk";
import { and, db, desc, gte, sql } from "../db";
import { jobs, scrapeResults, scraperConfigs } from "../db/schema";
import { CIRCUIT_BREAKER_THRESHOLD } from "../lib/helpers";
import { fetchDedupedJobsPage } from "./jobs/deduplication";
import { buildJobFilterConditions } from "./jobs/query-filters";
import { getAnalytics, type PlatformStats, type ScrapeAnalytics } from "./scrape-results";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ACTIVITY_LIMIT = 20;
const DEFAULT_OVERLAP_LIMIT = 8;

const TRIGGER_TASKS = [
  {
    taskIdentifier: "scrape-pipeline",
    label: "Scrape pipeline",
    cronExpression: "0 6,10,14,18 * * *",
    timezone: "Europe/Amsterdam",
  },
  {
    taskIdentifier: "scraper-health-check",
    label: "Scraper health check",
    cronExpression: "0 6 * * *",
    timezone: "Europe/Amsterdam",
  },
] as const;

type TransactionDb = typeof db;
type ScraperConfigRow = typeof scraperConfigs.$inferSelect;
type RecentRunRow = {
  id: string;
  configId: string | null;
  platform: string;
  runAt: Date | null;
  durationMs: number | null;
  jobsFound: number | null;
  jobsNew: number | null;
  duplicates: number | null;
  status: string;
  errors: unknown;
};

export type ScraperDashboardOptions = {
  activityLimit?: number;
  overlapLimit?: number;
  includeTrigger?: boolean;
};

export type HealthSignal = {
  level: "info" | "warning" | "critical";
  code:
    | "inactive"
    | "never_run"
    | "circuit_breaker_open"
    | "schedule_overdue"
    | "recent_failures"
    | "partial_run"
    | "latest_error";
  message: string;
};

export type PlatformRecentWindow = {
  runs: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  successRate: number;
  avgDurationMs: number;
};

export type PlatformOperationalMetrics = {
  platform: string;
  isActive: boolean;
  baseUrl: string | null;
  cronExpression: string | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  nextRunAt: Date | null;
  isOverdue: boolean;
  consecutiveFailures: number;
  circuitBreakerOpen: boolean;
  latestError: string | null;
  status: "gezond" | "waarschuwing" | "kritiek" | "inactief";
  signals: HealthSignal[];
  lifetime: PlatformStats;
  recent24h: PlatformRecentWindow;
};

export type ScraperActivityItem = {
  id: string;
  type: "success" | "warning" | "error";
  platform: string;
  occurredAt: Date | null;
  title: string;
  message: string;
  status: string;
  errors: string[];
  errorCount: number;
  jobsFound: number;
  jobsNew: number;
  duplicates: number;
  skipped: number;
  durationMs: number | null;
  runId: string;
  href: string;
};

export type OverlapReference = {
  id: string;
  platform: string;
  externalId: string;
  externalUrl: string | null;
  clientReferenceCode: string | null;
  title: string;
  company: string | null;
  endClient: string | null;
  location: string | null;
  province: string | null;
  postedAt: Date | null;
  applicationDeadline: Date | null;
  startDate: Date | null;
  scrapedAt: Date | null;
};

export type ListingOverlapGroup = {
  groupId: string;
  strategy:
    | "client_reference_title"
    | "title_organization_province"
    | "title_organization_location"
    | "title_organization_deadline"
    | "title_organization_start_date";
  title: string;
  criteria: string[];
  sharedValues: Record<string, string>;
  listings: OverlapReference[];
  platforms: string[];
};

export type TriggerRunSummary = {
  id: string | null;
  taskIdentifier: string | null;
  status: string | null;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
};

export type TriggerTaskVisibility = {
  taskIdentifier: string;
  label: string;
  cronExpression: string;
  timezone: string;
  latestRun: TriggerRunSummary | null;
  recentRuns: TriggerRunSummary[];
};

export type TriggerVisibility = {
  available: boolean;
  checkedAt: string;
  reason: string | null;
  tasks: TriggerTaskVisibility[];
};

export type ScraperDashboardData = {
  generatedAt: string;
  configs: ScraperConfigRow[];
  analytics: ScrapeAnalytics;
  activeVacancies: number;
  recentRuns: RecentRunRow[];
  platforms: PlatformOperationalMetrics[];
  activity: ScraperActivityItem[];
  overlap: {
    totalGroups: number;
    groups: ListingOverlapGroup[];
  };
  trigger: TriggerVisibility;
};

type PlatformHealthInput = {
  isActive: boolean;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  nextRunAt: Date | null;
  consecutiveFailures: number;
  circuitBreakerOpen: boolean;
  recent24h: PlatformRecentWindow;
  latestError: string | null;
  now?: Date;
};

type OverlapCandidate = OverlapReference & {
  normalizedTitle: string;
  normalizedCompany: string | null;
  normalizedEndClient: string | null;
  normalizedProvince: string | null;
  normalizedLocation: string | null;
  normalizedClientReferenceCode: string | null;
  normalizedDeadlineDay: string | null;
  normalizedStartDateDay: string | null;
};

type OverlapStrategyDefinition = {
  code: ListingOverlapGroup["strategy"];
  priority: number;
  criteria: string[];
  buildKey: (job: OverlapCandidate) => string | null;
  buildSharedValues: (job: OverlapCandidate) => Record<string, string>;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function clamp(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

async function getActiveVacancyCount(database: TransactionDb = db): Promise<number> {
  // Tests inject a mock database object to validate query patterns; skip the
  // extra active-vacancy query in that scenario to avoid unintended DB access.
  if (database !== db) {
    return 0;
  }

  const whereConditions = buildJobFilterConditions();
  const whereClause = (
    whereConditions.length > 0 ? and(...whereConditions) : sql`true`
  ) as ReturnType<typeof sql>;
  const page = await fetchDedupedJobsPage({
    whereClause,
    limit: 1,
    offset: 0,
  });
  return page.total;
}

function cronIntervalMs(cron: string | null | undefined): number | null {
  if (!cron) return null;

  const parts = cron.trim().split(/\s+/);
  const fields = parts.length === 6 ? parts.slice(1) : parts;
  if (fields.length !== 5) return null;

  const [minute, hour] = fields;
  const hourMatch = hour.match(/^\*\/(\d+)$/);
  if (hourMatch && minute === "0") {
    return Number.parseInt(hourMatch[1], 10) * 3_600_000;
  }

  const minuteMatch = minute.match(/^\*\/(\d+)$/);
  if (minuteMatch) {
    return Number.parseInt(minuteMatch[1], 10) * 60_000;
  }

  return null;
}

function getNextRunAt(config: {
  lastRunAt: Date | null;
  cronExpression: string | null;
}): Date | null {
  if (!config.lastRunAt || !config.cronExpression) return null;
  const interval = cronIntervalMs(config.cronExpression);
  if (!interval) return null;
  return new Date(config.lastRunAt.getTime() + interval);
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function normalizeDateKey(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function getSharedOrganization(job: OverlapCandidate): string | null {
  return job.normalizedEndClient ?? job.normalizedCompany;
}

export function derivePlatformHealth(input: PlatformHealthInput): {
  status: PlatformOperationalMetrics["status"];
  signals: HealthSignal[];
  isOverdue: boolean;
} {
  if (!input.isActive) {
    return {
      status: "inactief",
      isOverdue: false,
      signals: [{ level: "info", code: "inactive", message: "Scraper is uitgeschakeld." }],
    };
  }

  const signals: HealthSignal[] = [];
  const now = input.now ?? new Date();
  const isOverdue = input.nextRunAt ? input.nextRunAt.getTime() <= now.getTime() : false;

  if (!input.lastRunAt) {
    signals.push({
      level: "warning",
      code: "never_run",
      message: "Nog geen succesvolle of mislukte run geregistreerd.",
    });
  }

  if (input.circuitBreakerOpen) {
    signals.push({
      level: "critical",
      code: "circuit_breaker_open",
      message: `Circuit breaker open na ${input.consecutiveFailures} opeenvolgende fouten.`,
    });
  }

  if (isOverdue) {
    signals.push({
      level: input.circuitBreakerOpen ? "critical" : "warning",
      code: "schedule_overdue",
      message: "Volgens het cron-schema had deze scraper al opnieuw moeten draaien.",
    });
  }

  if (input.recent24h.failedCount > 0) {
    signals.push({
      level: input.recent24h.failedCount >= 3 ? "critical" : "warning",
      code: "recent_failures",
      message: `${input.recent24h.failedCount} mislukte runs in de laatste 24 uur.`,
    });
  }

  if (input.lastRunStatus === "partial") {
    signals.push({
      level: "warning",
      code: "partial_run",
      message: "Laatste run was gedeeltelijk succesvol.",
    });
  }

  if (input.latestError) {
    signals.push({
      level: input.lastRunStatus === "failed" ? "critical" : "warning",
      code: "latest_error",
      message: `Laatste fout: ${input.latestError}`,
    });
  }

  const status: PlatformOperationalMetrics["status"] = signals.some(
    (signal) => signal.level === "critical",
  )
    ? "kritiek"
    : signals.some((signal) => signal.level === "warning")
      ? "waarschuwing"
      : "gezond";

  return { status, signals, isOverdue };
}

const OVERLAP_STRATEGIES: OverlapStrategyDefinition[] = [
  {
    code: "client_reference_title",
    priority: 1,
    criteria: ["zelfde genormaliseerde titel", "zelfde client referentiecode"],
    buildKey: (job) =>
      job.normalizedClientReferenceCode && job.normalizedTitle
        ? [job.normalizedClientReferenceCode, job.normalizedTitle].join("::")
        : null,
    buildSharedValues: (job) => ({
      clientReferenceCode: job.clientReferenceCode ?? "",
      title: job.title,
    }),
  },
  {
    code: "title_organization_province",
    priority: 2,
    criteria: ["zelfde genormaliseerde titel", "zelfde organisatie", "zelfde provincie"],
    buildKey: (job) => {
      const organization = getSharedOrganization(job);
      return job.normalizedTitle && organization && job.normalizedProvince
        ? [job.normalizedTitle, organization, job.normalizedProvince].join("::")
        : null;
    },
    buildSharedValues: (job) => ({
      title: job.title,
      organization: job.endClient ?? job.company ?? "",
      province: job.province ?? "",
    }),
  },
  {
    code: "title_organization_location",
    priority: 3,
    criteria: ["zelfde genormaliseerde titel", "zelfde organisatie", "zelfde locatie"],
    buildKey: (job) => {
      const organization = getSharedOrganization(job);
      return job.normalizedTitle && organization && job.normalizedLocation
        ? [job.normalizedTitle, organization, job.normalizedLocation].join("::")
        : null;
    },
    buildSharedValues: (job) => ({
      title: job.title,
      organization: job.endClient ?? job.company ?? "",
      location: job.location ?? "",
    }),
  },
  {
    code: "title_organization_deadline",
    priority: 4,
    criteria: ["zelfde genormaliseerde titel", "zelfde organisatie", "zelfde deadline-dag"],
    buildKey: (job) => {
      const organization = getSharedOrganization(job);
      return job.normalizedTitle && organization && job.normalizedDeadlineDay
        ? [job.normalizedTitle, organization, job.normalizedDeadlineDay].join("::")
        : null;
    },
    buildSharedValues: (job) => ({
      title: job.title,
      organization: job.endClient ?? job.company ?? "",
      applicationDeadline: job.normalizedDeadlineDay ?? "",
    }),
  },
  {
    code: "title_organization_start_date",
    priority: 5,
    criteria: ["zelfde genormaliseerde titel", "zelfde organisatie", "zelfde startdatum"],
    buildKey: (job) => {
      const organization = getSharedOrganization(job);
      return job.normalizedTitle && organization && job.normalizedStartDateDay
        ? [job.normalizedTitle, organization, job.normalizedStartDateDay].join("::")
        : null;
    },
    buildSharedValues: (job) => ({
      title: job.title,
      organization: job.endClient ?? job.company ?? "",
      startDate: job.normalizedStartDateDay ?? "",
    }),
  },
];

export function buildListingOverlapGroups(input: OverlapReference[]): ListingOverlapGroup[] {
  const jobsById = new Map<string, OverlapCandidate>();

  for (const job of input) {
    jobsById.set(job.id, {
      ...job,
      normalizedTitle: normalizeText(job.title) ?? "",
      normalizedCompany: normalizeText(job.company),
      normalizedEndClient: normalizeText(job.endClient),
      normalizedProvince: normalizeText(job.province),
      normalizedLocation: normalizeText(job.location),
      normalizedClientReferenceCode: normalizeText(job.clientReferenceCode),
      normalizedDeadlineDay: normalizeDateKey(job.applicationDeadline),
      normalizedStartDateDay: normalizeDateKey(job.startDate),
    });
  }

  const candidates: Array<ListingOverlapGroup & { priority: number; jobIds: string[] }> = [];

  for (const strategy of OVERLAP_STRATEGIES) {
    const buckets = new Map<string, OverlapCandidate[]>();

    for (const job of jobsById.values()) {
      const key = strategy.buildKey(job);
      if (!key || !job.normalizedTitle) continue;
      const bucket = buckets.get(key) ?? [];
      bucket.push(job);
      buckets.set(key, bucket);
    }

    for (const [key, bucket] of buckets) {
      const distinctPlatforms = new Set(bucket.map((job) => job.platform));
      if (bucket.length < 2 || distinctPlatforms.size < 2) continue;
      const primary = bucket[0];
      if (!primary) continue;

      candidates.push({
        groupId: `${strategy.code}:${key}`,
        strategy: strategy.code,
        title: primary.title,
        criteria: strategy.criteria,
        sharedValues: strategy.buildSharedValues(primary),
        listings: bucket
          .map((job) => ({
            id: job.id,
            platform: job.platform,
            externalId: job.externalId,
            externalUrl: job.externalUrl,
            clientReferenceCode: job.clientReferenceCode,
            title: job.title,
            company: job.company,
            endClient: job.endClient,
            location: job.location,
            province: job.province,
            postedAt: job.postedAt,
            applicationDeadline: job.applicationDeadline,
            startDate: job.startDate,
            scrapedAt: job.scrapedAt,
          }))
          .sort(
            (left, right) => (right.scrapedAt?.getTime() ?? 0) - (left.scrapedAt?.getTime() ?? 0),
          ),
        platforms: [...distinctPlatforms].sort(),
        priority: strategy.priority,
        jobIds: bucket.map((job) => job.id),
      });
    }
  }

  candidates.sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    if (left.platforms.length !== right.platforms.length) {
      return right.platforms.length - left.platforms.length;
    }
    return right.listings.length - left.listings.length;
  });

  const claimedJobIds = new Set<string>();
  const selected: ListingOverlapGroup[] = [];

  for (const candidate of candidates) {
    if (candidate.jobIds.some((jobId) => claimedJobIds.has(jobId))) continue;
    for (const jobId of candidate.jobIds) {
      claimedJobIds.add(jobId);
    }
    selected.push({
      groupId: candidate.groupId,
      strategy: candidate.strategy,
      title: candidate.title,
      criteria: candidate.criteria,
      sharedValues: candidate.sharedValues,
      listings: candidate.listings,
      platforms: candidate.platforms,
    });
  }

  return selected;
}

function buildActivityFeed(runsInput: RecentRunRow[], limit: number): ScraperActivityItem[] {
  return runsInput.slice(0, limit).map((run) => {
    const errors = asStringArray(run.errors);
    const jobsFound = run.jobsFound ?? 0;
    const jobsNew = run.jobsNew ?? 0;
    const duplicates = run.duplicates ?? 0;
    const skipped = Math.max(jobsFound - jobsNew - duplicates, 0);
    const type =
      run.status === "failed" ? "error" : run.status === "partial" ? "warning" : "success";
    const title =
      type === "error"
        ? `${run.platform}: scrape mislukt`
        : type === "warning"
          ? `${run.platform}: scrape gedeeltelijk`
          : `${run.platform}: scrape geslaagd`;
    const message =
      errors[0] ??
      `${jobsNew} nieuw, ${duplicates} duplicaten, ${skipped} overgeslagen uit ${jobsFound} listings.`;

    return {
      id: `activity:${run.id}`,
      type,
      platform: run.platform,
      occurredAt: run.runAt,
      title,
      message,
      status: run.status,
      errors,
      errorCount: errors.length,
      jobsFound,
      jobsNew,
      duplicates,
      skipped,
      durationMs: run.durationMs,
      runId: run.id,
      href: `/scraper/runs/${run.id}`,
    };
  });
}

function getTriggerField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

function normalizeTriggerRun(run: unknown): TriggerRunSummary {
  if (!run || typeof run !== "object") {
    return {
      id: null,
      taskIdentifier: null,
      status: null,
      createdAt: null,
      startedAt: null,
      finishedAt: null,
      error: null,
    };
  }

  const record = run as Record<string, unknown>;
  const rawError = record.error;
  const error =
    rawError &&
    typeof rawError === "object" &&
    typeof (rawError as { message?: unknown }).message === "string"
      ? ((rawError as { message: string }).message ?? null)
      : typeof rawError === "string"
        ? rawError
        : null;

  return {
    id: getTriggerField(record, "id"),
    taskIdentifier: getTriggerField(record, "taskIdentifier"),
    status: getTriggerField(record, "status"),
    createdAt: getTriggerField(record, "createdAt"),
    startedAt: getTriggerField(record, "startedAt"),
    finishedAt: getTriggerField(record, "finishedAt"),
    error,
  };
}

async function getTriggerVisibility(limit = 8): Promise<TriggerVisibility> {
  const checkedAt = new Date().toISOString();

  try {
    const runList: TriggerRunSummary[] = [];

    for await (const run of runs.list({
      limit,
      taskIdentifier: TRIGGER_TASKS.map((task) => task.taskIdentifier),
      from: new Date(Date.now() - 7 * DAY_MS),
    })) {
      runList.push(normalizeTriggerRun(run));
      if (runList.length >= limit) break;
    }

    return {
      available: true,
      checkedAt,
      reason: null,
      tasks: TRIGGER_TASKS.map((task) => {
        const recentRuns = runList.filter((run) => run.taskIdentifier === task.taskIdentifier);
        return {
          taskIdentifier: task.taskIdentifier,
          label: task.label,
          cronExpression: task.cronExpression,
          timezone: task.timezone,
          latestRun: recentRuns[0] ?? null,
          recentRuns,
        };
      }),
    };
  } catch (error) {
    return {
      available: false,
      checkedAt,
      reason: error instanceof Error ? error.message : "Trigger.dev is niet beschikbaar.",
      tasks: TRIGGER_TASKS.map((task) => ({
        taskIdentifier: task.taskIdentifier,
        label: task.label,
        cronExpression: task.cronExpression,
        timezone: task.timezone,
        latestRun: null,
        recentRuns: [],
      })),
    };
  }
}

function emptyPlatformStats(platform: string): PlatformStats {
  return {
    platform,
    totalRuns: 0,
    successCount: 0,
    partialCount: 0,
    failedCount: 0,
    successRate: 0,
    totalJobsFound: 0,
    totalJobsNew: 0,
    totalDuplicates: 0,
    avgDurationMs: 0,
  };
}

export async function getScraperDashboardData(
  opts: ScraperDashboardOptions = {},
  database: TransactionDb = db,
): Promise<ScraperDashboardData> {
  const activityLimit = clamp(opts.activityLimit, DEFAULT_ACTIVITY_LIMIT, 1, 50);
  const overlapLimit = clamp(opts.overlapLimit, DEFAULT_OVERLAP_LIMIT, 1, 25);
  const includeTrigger = opts.includeTrigger !== false;
  const now = new Date();
  const last24Hours = new Date(now.getTime() - DAY_MS);
  const runLimit = Math.max(30, activityLimit);
  const triggerPromise = includeTrigger
    ? getTriggerVisibility(8)
    : Promise.resolve<TriggerVisibility>({
        available: false,
        checkedAt: now.toISOString(),
        reason: "Trigger.dev zichtbaarheid is uitgeschakeld voor deze aanvraag.",
        tasks: TRIGGER_TASKS.map((task) => ({
          taskIdentifier: task.taskIdentifier,
          label: task.label,
          cronExpression: task.cronExpression,
          timezone: task.timezone,
          latestRun: null,
          recentRuns: [],
        })),
      });
  // Do not wrap these reads in database.transaction() with Promise.all: Drizzle + pg
  // concurrent work inside a transaction can drop Next.js App Router AsyncLocalStorage
  // (request context for cookies/headers), which throws "Access to storage is not allowed
  // from this context". Same rationale as app/overzicht/data.ts getOverviewData.
  const dataPromise = (async () => {
    const [analytics, configs, recentRuns, recentWindowRows, overlapCandidates] = await Promise.all(
      [
        getAnalytics(database),
        database.select().from(scraperConfigs).orderBy(scraperConfigs.platform),
        database
          .select({
            id: scrapeResults.id,
            configId: scrapeResults.configId,
            platform: scrapeResults.platform,
            runAt: scrapeResults.runAt,
            durationMs: scrapeResults.durationMs,
            jobsFound: scrapeResults.jobsFound,
            jobsNew: scrapeResults.jobsNew,
            duplicates: scrapeResults.duplicates,
            status: scrapeResults.status,
            errors: scrapeResults.errors,
          })
          .from(scrapeResults)
          .orderBy(desc(scrapeResults.runAt))
          .limit(runLimit),
        database
          .select({
            platform: scrapeResults.platform,
            runs: sql<number>`cast(count(*) as integer)`,
            successCount: sql<number>`cast(count(*) filter (where ${scrapeResults.status} = 'success') as integer)`,
            partialCount: sql<number>`cast(count(*) filter (where ${scrapeResults.status} = 'partial') as integer)`,
            failedCount: sql<number>`cast(count(*) filter (where ${scrapeResults.status} = 'failed') as integer)`,
            avgDurationMs: sql<number>`cast(coalesce(avg(${scrapeResults.durationMs}), 0) as integer)`,
          })
          .from(scrapeResults)
          .where(gte(scrapeResults.runAt, last24Hours))
          .groupBy(scrapeResults.platform),
        database
          .select({
            id: jobs.id,
            platform: jobs.platform,
            externalId: jobs.externalId,
            externalUrl: jobs.externalUrl,
            clientReferenceCode: jobs.clientReferenceCode,
            title: jobs.title,
            company: jobs.company,
            endClient: jobs.endClient,
            location: jobs.location,
            province: jobs.province,
            postedAt: jobs.postedAt,
            applicationDeadline: jobs.applicationDeadline,
            startDate: jobs.startDate,
            scrapedAt: jobs.scrapedAt,
          })
          .from(jobs)
          .where(sql`${jobs.platform} is not null`),
      ],
    );

    return { analytics, configs, recentRuns, recentWindowRows, overlapCandidates };
  })();

  const [trigger, data, activeVacancies] = await Promise.all([
    triggerPromise,
    dataPromise,
    getActiveVacancyCount(database),
  ]);

  const recentWindowMap = new Map(
    data.recentWindowRows.map((row) => [
      row.platform,
      {
        runs: row.runs,
        successCount: row.successCount,
        partialCount: row.partialCount,
        failedCount: row.failedCount,
        successRate:
          row.runs > 0 ? Math.round(((row.successCount + row.partialCount) / row.runs) * 100) : 0,
        avgDurationMs: row.avgDurationMs,
      } satisfies PlatformRecentWindow,
    ]),
  );

  const latestErrorByPlatform = new Map<string, string>();
  for (const run of data.recentRuns) {
    if (!latestErrorByPlatform.has(run.platform)) {
      const errors = asStringArray(run.errors);
      if (errors[0]) latestErrorByPlatform.set(run.platform, errors[0]);
    }
  }

  const analyticsByPlatform = new Map(
    data.analytics.byPlatform.map((platformStats) => [platformStats.platform, platformStats]),
  );
  const knownPlatforms = new Set<string>([
    ...data.configs.map((config) => config.platform),
    ...data.analytics.byPlatform.map((row) => row.platform),
  ]);

  const platforms = [...knownPlatforms]
    .sort((left, right) => left.localeCompare(right))
    .map((platform) => {
      const config = data.configs.find((item) => item.platform === platform);
      const lifetime = analyticsByPlatform.get(platform) ?? emptyPlatformStats(platform);
      const recent24h = recentWindowMap.get(platform) ?? {
        runs: 0,
        successCount: 0,
        partialCount: 0,
        failedCount: 0,
        successRate: 0,
        avgDurationMs: 0,
      };
      const nextRunAt = getNextRunAt({
        lastRunAt: config?.lastRunAt ?? null,
        cronExpression: config?.cronExpression ?? null,
      });
      const health = derivePlatformHealth({
        isActive: config?.isActive ?? true,
        lastRunAt: config?.lastRunAt ?? null,
        lastRunStatus: config?.lastRunStatus ?? null,
        nextRunAt,
        consecutiveFailures: config?.consecutiveFailures ?? 0,
        circuitBreakerOpen: (config?.consecutiveFailures ?? 0) >= CIRCUIT_BREAKER_THRESHOLD,
        recent24h,
        latestError: latestErrorByPlatform.get(platform) ?? null,
        now,
      });

      return {
        platform,
        isActive: config?.isActive ?? true,
        baseUrl: config?.baseUrl ?? null,
        cronExpression: config?.cronExpression ?? null,
        lastRunAt: config?.lastRunAt ?? null,
        lastRunStatus: config?.lastRunStatus ?? null,
        nextRunAt,
        isOverdue: health.isOverdue,
        consecutiveFailures: config?.consecutiveFailures ?? 0,
        circuitBreakerOpen: (config?.consecutiveFailures ?? 0) >= CIRCUIT_BREAKER_THRESHOLD,
        latestError: latestErrorByPlatform.get(platform) ?? null,
        status: health.status,
        signals: health.signals,
        lifetime,
        recent24h,
      } satisfies PlatformOperationalMetrics;
    });

  const allOverlapGroups = buildListingOverlapGroups(data.overlapCandidates).sort(
    (left, right) => right.platforms.length - left.platforms.length,
  );
  const overlapGroups = allOverlapGroups.slice(0, overlapLimit);

  return {
    generatedAt: now.toISOString(),
    configs: data.configs,
    analytics: data.analytics,
    activeVacancies,
    recentRuns: data.recentRuns,
    platforms,
    activity: buildActivityFeed(data.recentRuns, activityLimit),
    overlap: {
      totalGroups: allOverlapGroups.length,
      groups: overlapGroups,
    },
    trigger,
  };
}
