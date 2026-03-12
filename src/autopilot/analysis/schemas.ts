import { z } from "zod";

export const evidenceAnalysisSchema = z.object({
  findings: z.array(
    z.object({
      title: z.string().describe("Short descriptive title of the finding"),
      category: z.enum(["bug", "ux", "perf", "ai-quality"]),
      severity: z.enum(["critical", "high", "medium", "low"]),
      confidence: z.number().min(0).max(1).describe("Confidence 0-1"),
      description: z.string().describe("Detailed description of what was found"),
      suspectedRootCause: z.string().optional().describe("What might be causing this"),
      recommendedAction: z.string().optional().describe("Suggested fix"),
      autoFixable: z.boolean().describe("Whether this could be auto-fixed"),
    }),
  ),
  overallHealthy: z.boolean().describe("Whether the page looks generally healthy"),
  summary: z.string().describe("One sentence summary of the analysis"),
});

export type EvidenceAnalysisOutput = z.infer<typeof evidenceAnalysisSchema>;
