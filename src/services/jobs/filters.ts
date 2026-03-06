import { and, asc, desc, gte, isNull, or, sql } from "drizzle-orm";
import { jobs } from "../../db/schema";
import type { Job } from "./repository";

export type ListJobsSortBy =
  | "nieuwste"
  | "tarief_hoog"
  | "tarief_laag"
  | "deadline"
  | "geplaatst"
  | "startdatum";

export type JobStatus = "open" | "gesloten";

const LIST_JOBS_SORT_VALUES: ListJobsSortBy[] = [
  "nieuwste",
  "tarief_hoog",
  "tarief_laag",
  "deadline",
  "geplaatst",
  "startdatum",
];

const sortByMap: Record<ListJobsSortBy, ReturnType<typeof desc>> = {
  nieuwste: desc(jobs.scrapedAt),
  tarief_hoog: sql`CASE WHEN ${jobs.rateMax} > 500 THEN NULL ELSE ${jobs.rateMax} END DESC NULLS LAST`,
  tarief_laag: sql`${jobs.rateMin} ASC NULLS LAST`,
  deadline: asc(jobs.applicationDeadline),
  geplaatst: desc(jobs.postedAt),
  startdatum: asc(jobs.startDate),
};

export function normalizeJobStatusFilter(value?: string | null): JobStatus | undefined {
  if (!value) return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === "all" || normalized === "alles") return undefined;
  if (normalized === "closed" || normalized === "gesloten") return "gesloten";
  if (normalized === "open") return "open";
  return undefined;
}

export function normalizeListJobsSortBy(value?: string | null): ListJobsSortBy | undefined {
  if (!value) return undefined;
  return LIST_JOBS_SORT_VALUES.includes(value as ListJobsSortBy)
    ? (value as ListJobsSortBy)
    : undefined;
}

export function deriveJobStatus({
  applicationDeadline,
  endDate,
  now = new Date(),
}: {
  applicationDeadline?: Date | null;
  endDate?: Date | null;
  now?: Date;
}): JobStatus {
  if (applicationDeadline) {
    return applicationDeadline >= now ? "open" : "gesloten";
  }

  if (endDate) {
    return endDate >= now ? "open" : "gesloten";
  }

  return "open";
}

export function getJobStatusCondition(status: JobStatus, now: Date) {
  if (status === "gesloten") {
    return or(
      sql`${jobs.applicationDeadline} < ${now}`,
      and(isNull(jobs.applicationDeadline), sql`${jobs.endDate} < ${now}`),
    );
  }

  return or(
    gte(jobs.applicationDeadline, now),
    and(isNull(jobs.applicationDeadline), isNull(jobs.endDate)),
    and(isNull(jobs.applicationDeadline), gte(jobs.endDate, now)),
  );
}

function getTimestamp(d: Date | string | null | undefined, fallback: number): number {
  if (!d) return fallback;
  return new Date(d).getTime();
}

export function getSortComparator(sortBy: ListJobsSortBy): (a: Job, b: Job) => number {
  switch (sortBy) {
    case "tarief_hoog":
      return (a, b) => {
        const aRate = a.rateMax && a.rateMax <= 500 ? a.rateMax : 0;
        const bRate = b.rateMax && b.rateMax <= 500 ? b.rateMax : 0;
        return bRate - aRate;
      };
    case "tarief_laag":
      return (a, b) =>
        (a.rateMin ?? Number.MAX_SAFE_INTEGER) - (b.rateMin ?? Number.MAX_SAFE_INTEGER);
    case "deadline":
      return (a, b) =>
        getTimestamp(a.applicationDeadline, Number.MAX_SAFE_INTEGER) -
        getTimestamp(b.applicationDeadline, Number.MAX_SAFE_INTEGER);
    case "geplaatst":
      return (a, b) => getTimestamp(b.postedAt, 0) - getTimestamp(a.postedAt, 0);
    case "startdatum":
      return (a, b) =>
        getTimestamp(a.startDate, Number.MAX_SAFE_INTEGER) -
        getTimestamp(b.startDate, Number.MAX_SAFE_INTEGER);
    default:
      return () => 0;
  }
}

export function getListJobsOrderBy(sortBy: ListJobsSortBy = "nieuwste") {
  return sortByMap[sortBy];
}
