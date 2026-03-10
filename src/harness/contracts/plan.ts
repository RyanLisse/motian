import { z } from "zod";
import { harnessEvaluationPolicySchema } from "./policy";
import { harnessArtifactKindSchema } from "./run";

export const harnessDispatchDefinitionSchema = z.object({
  id: z.string().trim().min(1),
  dispatch: z.string().trim().min(1),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  command: z.string().trim().min(1).optional(),
  args: z.array(z.string()).default([]),
  timeoutMs: z.number().int().positive().optional(),
  required: z.boolean().default(true),
  dependsOnDispatches: z.array(z.string().trim().min(1)).default([]),
  requiredArtifacts: z.array(harnessArtifactKindSchema).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const harnessTaskDefinitionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1).optional(),
  dependsOn: z.array(z.string().trim().min(1)).default([]),
  acceptanceCriteria: z.array(z.string().trim().min(1)).default([]),
  dispatches: z.array(harnessDispatchDefinitionSchema).default([]),
  evaluation: harnessEvaluationPolicySchema.default({}),
  metadata: z.record(z.unknown()).default({}),
});

export const harnessPlanDefinitionSchema = z.object({
  version: z.literal("1").default("1"),
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1).optional(),
  tasks: z.array(harnessTaskDefinitionSchema).min(1),
  evaluation: harnessEvaluationPolicySchema.default({}),
  metadata: z.record(z.unknown()).default({}),
});

export type HarnessDispatchDefinition = z.infer<typeof harnessDispatchDefinitionSchema>;
export type HarnessTaskDefinition = z.infer<typeof harnessTaskDefinitionSchema>;
export type HarnessPlanDefinition = z.infer<typeof harnessPlanDefinitionSchema>;
