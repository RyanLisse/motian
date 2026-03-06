import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { jobs } from "../../db/schema";
import type { Job } from "./repository";

export type ListJobsSortBy =
  | "nieuwste"
  | "tarief_hoog"
  | "tarief_laag"
  | "deadline"
  | "geplaatst"
  | "startdatum";

export type JobStatus = "open" | "closed" | "all";

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
  if (normalized === "all" || normalized === "alles") return "all";
  if (normalized === "closed" || normalized === "gesloten") return "closed";
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
  status,
  applicationDeadline,
  endDate,
  now = new Date(),
}: {
  status?: string | null;
  applicationDeadline?: Date | null;
  endDate?: Date | null;
  now?: Date;
}): JobStatus {
  if (status === "open" || status === "closed") {
    return status;
  }

  if (applicationDeadline) {
    return applicationDeadline >= now ? "open" : "closed";
  }

  if (endDate) {
    return endDate >= now ? "open" : "closed";
  }

  return "open";
}

export function getJobStatusCondition(status: JobStatus) {
  const visibleCondition = isNull(jobs.deletedAt);

  if (status === "all") {
    return visibleCondition;
  }

  return and(visibleCondition, eq(jobs.status, status));
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
