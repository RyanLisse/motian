import { z } from "zod";
import {
  harnessArtifactKindSchema,
  harnessFinalRunStatusSchema,
  harnessRunStatusSchema,
} from "./run";

export const HARNESS_RISK_TIERS = ["high", "medium", "low"] as const;

export const harnessRiskTierSchema = z.enum(HARNESS_RISK_TIERS);
export const harnessManualSignalSchema = z.string().trim().min(1);

export type HarnessJsonValue =
  | boolean
  | number
  | string
  | null
  | { [key: string]: HarnessJsonValue }
  | HarnessJsonValue[];

export const harnessJsonValueSchema: z.ZodType<HarnessJsonValue> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.number(),
    z.string(),
    z.null(),
    z.array(harnessJsonValueSchema),
    z.record(harnessJsonValueSchema),
  ]),
);

export const harnessCompletionRequirementSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("dispatch_status"),
    dispatchId: z.string().trim().min(1),
    status: harnessFinalRunStatusSchema,
  }),
  z.object({
    kind: z.literal("lifecycle_status"),
    dispatchId: z.string().trim().min(1).optional(),
    status: harnessRunStatusSchema,
  }),
  z.object({
    kind: z.literal("artifact_kind"),
    dispatchId: z.string().trim().min(1).optional(),
    artifactKind: harnessArtifactKindSchema,
    minCount: z.number().int().positive().default(1),
  }),
  z.object({
    kind: z.literal("result_path"),
    dispatchId: z.string().trim().min(1).optional(),
    path: z.string().trim().min(1),
    expected: harnessJsonValueSchema.optional(),
  }),
  z.object({
    kind: z.literal("external_context"),
    key: z.string().trim().min(1),
    expected: z.union([z.boolean(), z.number(), z.string()]).optional(),
  }),
  z.object({
    kind: z.literal("manual_signal"),
    signal: harnessManualSignalSchema,
  }),
]);

export const harnessObservedCompletionSignalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("dispatch_status"),
    dispatchId: z.string().trim().min(1),
    status: harnessFinalRunStatusSchema,
  }),
  z.object({
    kind: z.literal("lifecycle_status"),
    dispatchId: z.string().trim().min(1),
    status: harnessRunStatusSchema,
  }),
  z.object({
    kind: z.literal("artifact_kind"),
    dispatchId: z.string().trim().min(1),
    artifactKind: harnessArtifactKindSchema,
    path: z.string().trim().min(1).optional(),
  }),
  z.object({
    kind: z.literal("result_path"),
    dispatchId: z.string().trim().min(1),
    path: z.string().trim().min(1),
    value: harnessJsonValueSchema.optional(),
  }),
  z.object({
    kind: z.literal("external_context"),
    dispatchId: z.string().trim().min(1).optional(),
    key: z.string().trim().min(1),
    value: z.union([z.boolean(), z.number(), z.string()]),
  }),
  z.object({
    kind: z.literal("manual_signal"),
    signal: harnessManualSignalSchema,
    acknowledgedBy: z.string().trim().min(1).optional(),
  }),
]);

export const harnessCompletionPolicySchema = z.object({
  mode: z.enum(["all", "any"]).default("all"),
  requirements: z.array(harnessCompletionRequirementSchema).default([]),
  defaultDispatchSuccess: z.boolean().default(true),
});

export const harnessEvaluationPolicySchema = z.object({
  acceptableRunStatuses: z.array(harnessFinalRunStatusSchema).min(1).default(["succeeded"]),
  requiredArtifacts: z.array(harnessArtifactKindSchema).default([]),
  requiredChecks: z.array(z.string().trim().min(1)).default([]),
  requiredExternalContextKeys: z.array(z.string().trim().min(1)).default([]),
  completion: harnessCompletionPolicySchema.default({}),
});

export type HarnessRiskTier = z.infer<typeof harnessRiskTierSchema>;
export type HarnessJsonValueType = z.infer<typeof harnessJsonValueSchema>;
export type HarnessCompletionRequirement = z.infer<typeof harnessCompletionRequirementSchema>;
export type HarnessObservedCompletionSignal = z.infer<typeof harnessObservedCompletionSignalSchema>;
export type HarnessCompletionPolicy = z.infer<typeof harnessCompletionPolicySchema>;
export type HarnessEvaluationPolicy = z.infer<typeof harnessEvaluationPolicySchema>;
