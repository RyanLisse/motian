import { and, asc, desc, eq, isNotNull, isNull, ne, or, sql } from "../../db";
import { jobs } from "../../db/schema";
import type { Job } from "./repository";

export type ListJobsSortBy =
  | "nieuwste"
  | "tarief_hoog"
  | "tarief_laag"
  | "deadline"
  | "deadline_desc"
  | "geplaatst"
  | "startdatum";

export type JobStatus = "open" | "closed" | "archived" | "all";

const LIST_JOBS_SORT_VALUES: ListJobsSortBy[] = [
  "nieuwste",
  "tarief_hoog",
  "tarief_laag",
  "deadline",
  "deadline_desc",
  "geplaatst",
  "startdatum",
];

const sortByMap: Record<ListJobsSortBy, ReturnType<typeof desc>> = {
  nieuwste: desc(jobs.scrapedAt),
  tarief_hoog: sql`CASE WHEN ${jobs.rateMax} > 500 THEN NULL ELSE ${jobs.rateMax} END DESC NULLS LAST`,
  tarief_laag: sql`${jobs.rateMin} ASC NULLS LAST`,
  deadline: asc(jobs.applicationDeadline),
  deadline_desc: desc(jobs.applicationDeadline),
  geplaatst: desc(jobs.postedAt),
  startdatum: asc(jobs.startDate),
};

export function normalizeJobStatusFilter(value?: string | null): JobStatus | undefined {
  if (!value) return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === "all" || normalized === "alles") return "all";
  if (normalized === "archived" || normalized === "gearchiveerd" || normalized === "archief") {
    return "archived";
  }
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
  if (status === "open" || status === "closed" || status === "archived") {
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

export function getVisibleVacancyCondition() {
  return and(ne(jobs.status, "archived"), isNull(jobs.deletedAt));
}

export function getJobStatusCondition(status: JobStatus) {
  if (status === "all") {
    return sql`true`;
  }

  if (status === "archived") {
    // Jobs are "archived" either by status='archived' or by being soft-deleted
    return or(eq(jobs.status, "archived"), isNotNull(jobs.deletedAt));
  }

  return and(getVisibleVacancyCondition(), eq(jobs.status, status));
}

function getTimestamp(d: Date | string | null | undefined, fallback: number): number {
  if (!d) return fallback;
  return new Date(d).getTime();
}

export function getSortComparator(sortBy: ListJobsSortBy): (a: Job, b: Job) => number {
  switch (sortBy) {
    case "nieuwste":
      return (a, b) => getTimestamp(b.scrapedAt, 0) - getTimestamp(a.scrapedAt, 0);
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
    case "deadline_desc":
      return (a, b) =>
        getTimestamp(b.applicationDeadline, 0) - getTimestamp(a.applicationDeadline, 0);
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
