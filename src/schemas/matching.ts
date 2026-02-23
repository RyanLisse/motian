import { z } from "zod";

export const tierSchema = z
  .enum(["knockout", "gunning", "process"])
  .describe("Requirement classification tier");

export const classifiedRequirementSchema = z.object({
  criterion: z.string().describe("The requirement text from the job posting"),
  tier: tierSchema,
  weight: z.number().min(0).max(100).nullable().describe("Relative weight for scoring"),
  source: z
    .string()
    .describe("Where this requirement came from: requirements[], wishes[], description"),
});

export const criterionResultSchema = z.object({
  criterion: z.string().describe("The requirement text from the job posting"),
  tier: tierSchema,
  passed: z.boolean().nullable().describe("For knockout: true/false. For gunning/process: null"),
  stars: z
    .number()
    .min(1)
    .max(5)
    .nullable()
    .describe("For gunning: 1-5 stars. For knockout/process: null"),
  evidence: z.string().describe("Specific evidence from the CV supporting the assessment"),
  confidence: z.enum(["high", "medium", "low"]).describe("Confidence level of the assessment"),
});

export const structuredMatchOutputSchema = z.object({
  criteriaBreakdown: z.array(criterionResultSchema).describe("Per-criterion assessment results"),
  overallScore: z.number().min(0).max(100).describe("Weighted overall match score"),
  knockoutsPassed: z.boolean().describe("True if ALL knockout criteria are met"),
  riskProfile: z.array(z.string()).describe("List of risk flags"),
  enrichmentSuggestions: z.array(z.string()).describe("Suggestions to strengthen the match"),
  recommendation: z.enum(["go", "no-go", "conditional"]).describe("Final recommendation"),
  recommendationReasoning: z.string().describe("2-3 sentence summary of the recommendation"),
  recommendationConfidence: z
    .number()
    .min(0)
    .max(100)
    .describe("Confidence percentage of the recommendation"),
});

// Export inferred types
export type Tier = z.infer<typeof tierSchema>;
export type ClassifiedRequirement = z.infer<typeof classifiedRequirementSchema>;
export type CriterionResult = z.infer<typeof criterionResultSchema>;
export type StructuredMatchOutput = z.infer<typeof structuredMatchOutputSchema>;
