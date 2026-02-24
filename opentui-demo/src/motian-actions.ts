import type { ImportJobsSummary, ReviewGdprSummary, RunScoringSummary } from "./actions";
import { computeOldestRetentionDate } from "./motian-summary";

type ScrapeStartResponse = {
  platforms: Array<{
    platform: string;
    status: "success" | "failed";
    jobsNew?: number;
  }>;
};

type JobsResponse = {
  data: Array<{ id: string }>;
  total: number;
};

type GenerateMatchesResponse = {
  matchesCreated: number;
  totalCandidatesScored: number;
  errors?: string[];
};

type CandidatesResponse = {
  data: Array<{ dataRetentionUntil?: string | null }>;
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

const API_BASE_URL = process.env.MOTIAN_BASE_URL ?? "http://localhost:3001";
const API_SECRET = process.env.MOTIAN_API_SECRET;

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (API_SECRET) headers.set("Authorization", `Bearer ${API_SECRET}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error ?? body?.message ?? `Request failed: ${response.status}`);
  }

  return body as T;
}

export async function importJobsFromAts(): Promise<ImportJobsSummary> {
  const result = await apiJson<ScrapeStartResponse>("/api/scrape/starten", {
    method: "POST",
    body: "{}",
  });

  const successfulPlatforms = result.platforms.filter(
    (platform) => platform.status === "success",
  ).length;
  const failedPlatforms = result.platforms.length - successfulPlatforms;
  const jobsNew = result.platforms.reduce((sum, platform) => sum + (platform.jobsNew ?? 0), 0);

  return {
    totalPlatforms: result.platforms.length,
    successfulPlatforms,
    failedPlatforms,
    jobsNew,
  };
}

export async function runCandidateScoring(): Promise<RunScoringSummary> {
  const jobs = await apiJson<JobsResponse>("/api/opdrachten?limit=200");
  if (jobs.data.length === 0) {
    return {
      jobsProcessed: 0,
      candidatesConsidered: 0,
      matchesCreated: 0,
      duplicateMatches: 0,
      errors: 0,
    };
  }

  let candidatesConsidered = 0;
  let matchesCreated = 0;
  let errors = 0;

  for (const job of jobs.data) {
    try {
      const generated = await apiJson<GenerateMatchesResponse>("/api/matches/genereren", {
        method: "POST",
        body: JSON.stringify({ jobId: job.id, limit: 10 }),
      });

      candidatesConsidered += generated.totalCandidatesScored;
      matchesCreated += generated.matchesCreated;
      errors += generated.errors?.length ?? 0;
    } catch (_error) {
      errors += 1;
    }
  }

  return {
    jobsProcessed: jobs.data.length,
    candidatesConsidered,
    matchesCreated,
    duplicateMatches: 0,
    errors,
  };
}

export async function reviewGdprRequests(): Promise<ReviewGdprSummary> {
  let page = 1;
  let totalPages = 1;
  const retentionDates: Array<{ dataRetentionUntil: Date }> = [];

  while (page <= totalPages) {
    const response = await apiJson<CandidatesResponse>(`/api/kandidaten?page=${page}&limit=100`);
    totalPages = response.totalPages;

    for (const candidate of response.data) {
      if (!candidate.dataRetentionUntil) continue;
      const parsed = new Date(candidate.dataRetentionUntil);
      if (Number.isNaN(parsed.getTime())) continue;
      if (parsed.getTime() < Date.now()) {
        retentionDates.push({ dataRetentionUntil: parsed });
      }
    }

    page += 1;
  }

  return {
    expiredCandidates: retentionDates.length,
    oldestRetentionDate: computeOldestRetentionDate(retentionDates),
  };
}
