import "dotenv/config";
import type {
  ImportJobsSummary,
  KandidatenResult,
  MatchesResult,
  ReviewGdprSummary,
  RunScoringSummary,
  StatsResult,
  VacaturesResult,
  WorkspaceOverview,
} from "./actions";

// Direct service imports from parent project
import { countCandidates, listCandidates } from "@/src/services/candidates";
import { listJobs } from "@/src/services/jobs";
import { countMatches, listMatches } from "@/src/services/matches";
import { getApplicationStats } from "@/src/services/applications";
import { findExpiredRetentionCandidates } from "@/src/services/gdpr";
import {
  importJobsFromActiveScrapers,
  runCandidateScoringBatch,
} from "@/src/services/operations-console";
import { autoMatchCandidateToJobs } from "@/src/services/auto-matching";

export async function importJobsFromAts(): Promise<ImportJobsSummary> {
  const result = await importJobsFromActiveScrapers();
  return {
    totalPlatforms: result.totalPlatforms,
    successfulPlatforms: result.successfulPlatforms,
    failedPlatforms: result.failedPlatforms,
    jobsNew: result.jobsNew,
  };
}

export async function runCandidateScoring(): Promise<RunScoringSummary> {
  const result = await runCandidateScoringBatch();
  return {
    jobsProcessed: result.jobsProcessed,
    candidatesConsidered: result.candidatesConsidered,
    matchesCreated: result.matchesCreated,
    duplicateMatches: result.duplicateMatches,
    errors: result.errors,
  };
}

export async function reviewGdprRequests(): Promise<ReviewGdprSummary> {
  const expired = await findExpiredRetentionCandidates();
  const dates = expired
    .map((c) => c.dataRetentionUntil)
    .filter((d): d is Date => d != null);
  const oldest =
    dates.length > 0
      ? dates.reduce((a, b) => (a.getTime() < b.getTime() ? a : b))
      : null;
  return {
    expiredCandidates: expired.length,
    oldestRetentionDate: oldest,
  };
}

export async function getWorkspaceOverview(): Promise<WorkspaceOverview> {
  const [candidateCount, jobsResult, matchCount, appStats] = await Promise.all([
    countCandidates(),
    listJobs({ limit: 1 }),
    countMatches(),
    getApplicationStats(),
  ]);
  return {
    totalCandidates: candidateCount,
    totalJobs: jobsResult.total,
    totalMatches: matchCount,
    applicationStats: appStats,
  };
}

export async function zoekKandidaten(): Promise<KandidatenResult> {
  const rows = await listCandidates({ limit: 10 });
  return {
    candidates: rows.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      location: c.location,
    })),
    total: rows.length,
  };
}

export async function zoekVacatures(): Promise<VacaturesResult> {
  const result = await listJobs({ limit: 10 });
  return {
    jobs: result.data.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
    })),
    total: result.total,
  };
}

export async function zoekMatches(): Promise<MatchesResult> {
  const rows = await listMatches({ limit: 10 });
  return {
    matches: rows.map((m) => ({
      id: m.id,
      jobId: m.jobId ?? "",
      candidateId: m.candidateId ?? "",
      matchScore: m.matchScore,
      status: m.status,
    })),
    total: rows.length,
  };
}

export async function getSollicitatieStats(): Promise<StatsResult> {
  const stats = await getApplicationStats();
  return {
    total: stats.total,
    byStage: stats.byStage,
  };
}

export async function runAutoMatchDemo(): Promise<string[]> {
  const candidates = await listCandidates({ limit: 1 });
  const first = candidates[0];
  if (!first) {
    return ["Geen kandidaten gevonden om auto-match op te draaien."];
  }

  const results = await autoMatchCandidateToJobs(first.id);
  if (results.length === 0) {
    return [
      `Kandidaat: ${first.name}`,
      "Geen matches gevonden boven de drempel (40%).",
    ];
  }

  return [
    `Kandidaat: ${first.name}`,
    `Matches gevonden: ${results.length}`,
    ...results.map(
      (r) =>
        `  - ${r.jobTitle} (${r.company ?? "onbekend"}) — score: ${r.quickScore}%`,
    ),
  ];
}
