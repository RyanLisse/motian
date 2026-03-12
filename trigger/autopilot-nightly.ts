import { logger, schedules } from "@trigger.dev/sdk";
import { analyzeAllEvidence } from "@/src/autopilot/analysis";
import { ALL_JOURNEYS } from "@/src/autopilot/config";
import { captureJourneyEvidence } from "@/src/autopilot/evidence";
import { publishFindings } from "@/src/autopilot/github";
import { saveAutopilotFindings, saveAutopilotRun } from "@/src/autopilot/persistence";
import { generateMarkdownReport, uploadReportArtifacts } from "@/src/autopilot/reporting";
import {
  trackAutopilotIssuePublished,
  trackAutopilotRunCompleted,
  trackAutopilotRunFailed,
  trackAutopilotRunStarted,
} from "@/src/autopilot/telemetry";
import type { AutopilotEvidence, AutopilotRunSummary, RunStats } from "@/src/autopilot/types";

function resolveBaseUrl(): string {
  if (process.env.AUTOPILOT_BASE_URL) {
    return process.env.AUTOPILOT_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    const url = process.env.VERCEL_URL;
    return url.startsWith("http") ? url : `https://${url}`;
  }
  return "http://localhost:3002";
}

function resolveGitHubConfig() {
  const token = process.env.AUTOPILOT_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) return null;

  const repo = process.env.GITHUB_REPOSITORY; // "owner/repo"
  if (repo) {
    const [owner, name] = repo.split("/");
    if (owner && name) return { owner, repo: name, token };
  }

  const owner = process.env.GITHUB_OWNER ?? "RyanLisse";
  const name = process.env.GITHUB_REPO ?? "motian";
  return { owner, repo: name, token };
}

export const autopilotNightlyTask = schedules.task({
  id: "autopilot-nightly",
  cron: {
    pattern: "0 4 * * *",
    timezone: "Europe/Amsterdam",
  },
  maxDuration: 600,
  retry: {
    maxAttempts: 2,
  },
  run: async () => {
    const baseUrl = resolveBaseUrl();
    const evidenceDir = process.env.AUTOPILOT_EVIDENCE_DIR ?? "/tmp/autopilot-evidence";

    logger.info("Autopilot nightly run gestart", {
      baseUrl,
      evidenceDir,
      journeyCount: ALL_JOURNEYS.length,
    });
    trackAutopilotRunStarted("pending", ALL_JOURNEYS.length);

    try {
      // === Step 1: Capture evidence ===
      logger.info("Step 1: Capturing evidence...");
      const result = await captureJourneyEvidence(ALL_JOURNEYS, {
        baseUrl,
        evidenceDir,
      });

      // === Step 2: AI analysis ===
      logger.info("Step 2: Analyzing evidence with AI...");
      const manifests = result.journeyOutputs.map((o) => o.manifest);
      const findings = await analyzeAllEvidence(manifests, result.runId);
      logger.info(`AI analysis complete: ${findings.length} findings`);

      // === Step 3: Build summary ===
      const passedJourneys = result.journeyOutputs.filter((o) => o.result.success).length;
      const failedJourneys = result.journeyOutputs.filter((o) => !o.result.success).length;

      const findingsBySeverity: Record<string, number> = {};
      const findingsByCategory: Record<string, number> = {};
      for (const f of findings) {
        findingsBySeverity[f.severity] = (findingsBySeverity[f.severity] ?? 0) + 1;
        findingsByCategory[f.category] = (findingsByCategory[f.category] ?? 0) + 1;
      }

      const stats: RunStats = {
        totalJourneys: result.journeyOutputs.length,
        passedJourneys,
        failedJourneys,
        totalFindings: findings.length,
        findingsBySeverity,
        findingsByCategory,
      };

      const summary: AutopilotRunSummary = {
        runId: result.runId,
        status:
          failedJourneys === 0 && findings.filter((f) => f.severity === "critical").length === 0
            ? "completed"
            : "failed",
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        commitSha: result.gitSha,
        journeyResults: result.journeyOutputs.map((o) => o.result),
        findings,
        evidenceManifests: manifests,
        stats,
      };

      // === Step 3.5: Persist to database ===
      logger.info("Step 3.5: Persisting run to database...");
      try {
        await saveAutopilotRun(summary, undefined, undefined);
        await saveAutopilotFindings(findings);
        logger.info("Run persisted to database");
      } catch (dbErr) {
        logger.warn("DB persistence failed (non-fatal)", {
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
      }

      // === Step 4: Generate report ===
      logger.info("Step 4: Generating markdown report...");
      const markdownReport = generateMarkdownReport(summary);

      // === Step 5: Upload to Vercel Blob ===
      let reportUrl: string | undefined;
      try {
        logger.info("Step 5: Uploading artifacts to Vercel Blob...");
        const uploadResult = await uploadReportArtifacts(summary, markdownReport, evidenceDir);
        reportUrl = uploadResult.reportUrl;
        logger.info("Upload complete", {
          reportUrl,
          artifactCount: uploadResult.artifactUrls.length,
        });
      } catch (uploadErr) {
        logger.warn("Artifact upload failed (non-fatal)", {
          error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
        });
      }

      // Update DB with report URL
      try {
        await saveAutopilotRun({ ...summary }, reportUrl, undefined);
      } catch (_) {
        /* non-fatal */
      }

      // === Step 6: Publish GitHub issues ===
      const ghConfig = resolveGitHubConfig();
      if (ghConfig && findings.length > 0) {
        try {
          logger.info("Step 6: Publishing GitHub issues...", { findingCount: findings.length });

          // Build evidence map: findingId -> evidence[]
          const evidenceByFinding = new Map<string, AutopilotEvidence[]>();
          for (const finding of findings) {
            const relevantManifest = manifests.find((m) => m.surface === finding.surface);
            if (relevantManifest) {
              evidenceByFinding.set(finding.id, relevantManifest.artifacts);
            }
          }

          const published = await publishFindings(findings, evidenceByFinding, ghConfig, reportUrl);

          for (const issue of published) {
            trackAutopilotIssuePublished(
              result.runId,
              issue.findingId,
              issue.issueNumber,
              issue.created,
            );
          }

          // Update DB with GitHub issue numbers
          try {
            const issueMap = new Map<string, number>();
            for (const p of published) {
              issueMap.set(p.findingId, p.issueNumber);
            }
            await saveAutopilotFindings(findings, issueMap);
          } catch (_) {
            /* non-fatal */
          }

          logger.info("GitHub issues published", {
            total: published.length,
            created: published.filter((p) => p.created).length,
            updated: published.filter((p) => !p.created).length,
          });
        } catch (ghErr) {
          logger.warn("GitHub issue publishing failed (non-fatal)", {
            error: ghErr instanceof Error ? ghErr.message : String(ghErr),
          });
        }
      } else if (!ghConfig) {
        logger.info("Step 6: Skipping GitHub issues (no token configured)");
      } else {
        logger.info("Step 6: Skipping GitHub issues (no findings)");
      }

      // === Done ===
      logger.info("Autopilot nightly run voltooid", {
        runId: summary.runId,
        status: summary.status,
        totalJourneys: stats.totalJourneys,
        passedJourneys: stats.passedJourneys,
        failedJourneys: stats.failedJourneys,
        totalFindings: stats.totalFindings,
        reportUrl,
      });

      trackAutopilotRunCompleted(summary);
      return summary;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error("Autopilot nightly run mislukt", { error: errorMessage });
      trackAutopilotRunFailed("unknown", errorMessage);

      const failedSummary: AutopilotRunSummary = {
        runId: "unknown",
        status: "failed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        commitSha: "unknown",
        journeyResults: [],
        findings: [],
        evidenceManifests: [],
        stats: {
          totalJourneys: 0,
          passedJourneys: 0,
          failedJourneys: 0,
          totalFindings: 0,
          findingsBySeverity: {},
          findingsByCategory: {},
        },
      };

      return failedSummary;
    }
  },
});
