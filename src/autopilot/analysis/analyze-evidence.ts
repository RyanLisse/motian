import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { Output } from "ai";
import { geminiFlash, tracedGenerateText as generateText } from "@/src/lib/ai-models";
import { withRetry } from "@/src/lib/retry";
import type { EvidenceManifest } from "../types/evidence";
import type { AutopilotFinding } from "../types/finding";
import { type EvidenceAnalysisOutput, evidenceAnalysisSchema } from "./schemas";

const ANALYSIS_SYSTEM_PROMPT = `You are a QA engineer analyzing browser evidence from a Dutch recruitment platform called Motian.

You receive:
1. A screenshot of a web page (PNG image)
2. Console logs captured during page load

Your job is to identify any issues:
- **bug**: Broken functionality, error states, missing elements, JavaScript errors in console
- **ux**: Poor user experience, confusing layout, accessibility issues, broken styling
- **perf**: Slow loading, excessive console warnings, performance issues
- **ai-quality**: AI chat responses that are incorrect, unhelpful, or not in Dutch

Rules:
- Only report REAL issues you can see in the evidence. Do not speculate.
- Console warnings about React hydration or development mode are NOT bugs.
- An empty state (no data) is NOT a bug — it's expected for a new/demo instance.
- If the page looks healthy with no errors, return an empty findings array and overallHealthy=true.
- Be conservative — a false positive wastes developer time.
- Severity guide:
  - critical: Page completely broken, shows error page, or key functionality unusable
  - high: Major feature broken but page partially works
  - medium: Minor visual/UX issue or non-critical console errors
  - low: Cosmetic issue or suggestion for improvement`;

export interface AnalysisConfig {
  /** Max console log lines to include in prompt */
  maxConsoleLines?: number;
}

export async function analyzeManifestEvidence(
  manifest: EvidenceManifest,
  runId: string,
  config?: AnalysisConfig,
): Promise<AutopilotFinding[]> {
  const maxLines = config?.maxConsoleLines ?? 200;

  const screenshot = manifest.artifacts.find((a) => a.kind === "screenshot");
  const consoleLog = manifest.artifacts.find((a) => a.kind === "console-log");

  // If journey failed and we have no screenshot, create a finding from the failure
  if (!manifest.success && manifest.failureReason) {
    return [
      {
        id: crypto.randomUUID(),
        runId,
        category: "bug",
        surface: manifest.surface,
        title: `Journey "${manifest.journeyId}" failed to complete`,
        description: `The journey could not be executed: ${manifest.failureReason}`,
        severity: "critical",
        confidence: 1.0,
        autoFixable: false,
        status: "detected",
        fingerprint: `${manifest.surface}|bug|journey-execution-failure`,
        suspectedRootCause: manifest.failureReason,
        recommendedAction: "Check if the page is accessible and loads correctly",
      },
    ];
  }

  // Build multimodal prompt parts
  const promptParts: Array<{ type: "text"; text: string } | { type: "image"; image: Buffer }> = [];

  promptParts.push({
    type: "text" as const,
    text: `Analyzing journey: "${manifest.journeyId}" on surface: "${manifest.surface}"\n\nJourney completed: ${manifest.success ? "Yes" : "No"}`,
  });

  if (screenshot) {
    try {
      const imageBuffer = await readFile(screenshot.path);
      promptParts.push({ type: "image" as const, image: imageBuffer });
    } catch {
      promptParts.push({ type: "text" as const, text: "[Screenshot could not be loaded]" });
    }
  }

  if (consoleLog) {
    try {
      const logContent = await readFile(consoleLog.path, "utf-8");
      const lines = logContent.split("\n").slice(0, maxLines);
      const truncated = logContent.split("\n").length > maxLines;
      promptParts.push({
        type: "text" as const,
        text: `\n\nConsole logs (${lines.length} lines${truncated ? ", truncated" : ""}):\n\`\`\`\n${lines.join("\n")}\n\`\`\``,
      });
    } catch {
      promptParts.push({ type: "text" as const, text: "\n\n[Console logs could not be loaded]" });
    }
  }

  const { output } = await withRetry(
    () =>
      generateText({
        model: geminiFlash,
        output: Output.object({ schema: evidenceAnalysisSchema }),
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: promptParts }],
        providerOptions: { google: { structuredOutputs: true } },
      }),
    { label: `Autopilot Analysis (${manifest.journeyId})` },
  );

  if (!output) return [];

  const result = output as EvidenceAnalysisOutput;

  return result.findings.map((f) => ({
    id: crypto.randomUUID(),
    runId,
    category: f.category,
    surface: manifest.surface,
    title: f.title,
    description: f.description,
    severity: f.severity,
    confidence: f.confidence,
    autoFixable: f.autoFixable,
    status: "detected" as const,
    fingerprint: `${manifest.surface}|${f.category}|${f.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60)}`,
    suspectedRootCause: f.suspectedRootCause,
    recommendedAction: f.recommendedAction,
  }));
}

/**
 * Analyze all evidence manifests from a run, return combined findings.
 */
export async function analyzeAllEvidence(
  manifests: EvidenceManifest[],
  runId: string,
  config?: AnalysisConfig,
): Promise<AutopilotFinding[]> {
  const allFindings: AutopilotFinding[] = [];

  for (const manifest of manifests) {
    try {
      const findings = await analyzeManifestEvidence(manifest, runId, config);
      allFindings.push(...findings);
    } catch (err) {
      console.error(
        `[autopilot] Analysis failed for journey ${manifest.journeyId}:`,
        err instanceof Error ? err.message : err,
      );
      allFindings.push({
        id: crypto.randomUUID(),
        runId,
        category: "bug",
        surface: manifest.surface,
        title: `Evidence analysis failed for "${manifest.journeyId}"`,
        description: `The AI analysis could not be completed: ${err instanceof Error ? err.message : String(err)}`,
        severity: "medium",
        confidence: 1.0,
        autoFixable: false,
        status: "detected",
        fingerprint: `${manifest.surface}|bug|analysis-failure`,
      });
    }
  }

  return allFindings;
}
