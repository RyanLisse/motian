import { z } from "zod";

export const HARNESS_RUN_STATUSES = [
  "queued",
  "preparing_workspace",
  "workspace_ready",
  "running",
  "succeeded",
  "failed",
  "timed_out",
] as const;

export const HARNESS_FINAL_RUN_STATUSES = ["succeeded", "failed", "timed_out"] as const;

export const harnessIsoTimestampSchema = z.string().datetime({ offset: true });
export const harnessRunStatusSchema = z.enum(HARNESS_RUN_STATUSES);
export const harnessFinalRunStatusSchema = z.enum(HARNESS_FINAL_RUN_STATUSES);
export const harnessCommandSourceSchema = z.enum(["dispatch-script", "explicit"]);
export const harnessArtifactKindSchema = z.enum(["manifest", "stdout", "stderr", "workspace"]);
export const harnessExternalContextValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const harnessLifecycleEventSchema = z.object({
  status: harnessRunStatusSchema,
  at: harnessIsoTimestampSchema,
  detail: z.string().min(1),
});

export const harnessArtifactSchema = z.object({
  kind: harnessArtifactKindSchema,
  path: z.string().min(1),
  relativePath: z.string().min(1),
  description: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export const harnessProcessResultSchema = z.object({
  outcome: harnessFinalRunStatusSchema,
  exitCode: z.number().int().nullable(),
  signal: z.string().nullable(),
  pid: z.number().int().positive().optional(),
  timedOut: z.boolean(),
  startedAt: harnessIsoTimestampSchema,
  finishedAt: harnessIsoTimestampSchema,
  durationMs: z.number().int().nonnegative(),
  stdoutPath: z.string().min(1),
  stderrPath: z.string().min(1),
  stdoutTail: z.string(),
  stderrTail: z.string(),
  commandLine: z.string().min(1),
});

export const harnessCommandDescriptorSchema = z.object({
  executable: z.string().min(1),
  args: z.array(z.string()).default([]),
  timeoutMs: z.number().int().positive(),
  source: harnessCommandSourceSchema,
  envKeys: z.array(z.string()).default([]),
});

export const harnessRunManifestSchema = z.object({
  version: z.literal("1"),
  runId: z.string().min(1),
  dispatch: z.string().min(1),
  status: harnessRunStatusSchema,
  repoRoot: z.string().min(1),
  runRoot: z.string().min(1),
  createdAt: harnessIsoTimestampSchema,
  updatedAt: harnessIsoTimestampSchema,
  startedAt: harnessIsoTimestampSchema.optional(),
  finishedAt: harnessIsoTimestampSchema.optional(),
  workspace: z
    .object({
      isolation: z.string().min(1),
      root: z.string().min(1),
      baseRef: z.string().min(1),
      created: z.boolean(),
    })
    .optional(),
  command: harnessCommandDescriptorSchema,
  lifecycle: z.array(harnessLifecycleEventSchema).default([]),
  artifacts: z.array(harnessArtifactSchema).default([]),
  result: harnessProcessResultSchema.optional(),
  error: z.string().min(1).optional(),
  externalContext: z.record(harnessExternalContextValueSchema).optional(),
  integration: z.object({
    manifestPath: z.string().min(1),
    resumeToken: z.string().min(1),
  }),
});

export type HarnessRunStatus = z.infer<typeof harnessRunStatusSchema>;
export type HarnessFinalRunStatus = z.infer<typeof harnessFinalRunStatusSchema>;
export type HarnessArtifactKind = z.infer<typeof harnessArtifactKindSchema>;
export type HarnessExternalContextValue = z.infer<typeof harnessExternalContextValueSchema>;
export type HarnessLifecycleEvent = z.infer<typeof harnessLifecycleEventSchema>;
export type HarnessArtifact = z.infer<typeof harnessArtifactSchema>;
export type HarnessProcessResult = z.infer<typeof harnessProcessResultSchema>;
export type HarnessCommandDescriptor = z.infer<typeof harnessCommandDescriptorSchema>;
export type HarnessRunManifest = z.infer<typeof harnessRunManifestSchema>;
