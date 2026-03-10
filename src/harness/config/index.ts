import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";

const mergePolicyEntrySchema = z.object({
  requiredChecks: z.array(z.string().trim().min(1)).default([]),
  requireCodeReview: z.boolean().default(false),
});

export const defaultHarnessConfig = {
  version: "1" as const,
  riskTierRules: {
    high: [],
    medium: [],
    low: ["**"],
  },
  mergePolicy: {
    high: {
      requiredChecks: ["risk-policy-gate", "typecheck", "test", "lint"],
      requireCodeReview: true,
    },
    medium: {
      requiredChecks: ["risk-policy-gate", "typecheck", "test", "lint"],
      requireCodeReview: false,
    },
    low: { requiredChecks: ["risk-policy-gate", "lint"], requireCodeReview: false },
  },
  docsDriftRules: {
    triggers: {},
    message: "Schema/service changes detected. Please update the corresponding documentation.",
  },
  evidenceRequirements: {},
  harnessGap: {
    slaHours: 48,
    labelPrefix: "harness-gap",
  },
};

export const harnessConfigSchema = z.object({
  version: z.literal("1").default(defaultHarnessConfig.version),
  riskTierRules: z
    .object({
      high: z.array(z.string().trim().min(1)).default([...defaultHarnessConfig.riskTierRules.high]),
      medium: z
        .array(z.string().trim().min(1))
        .default([...defaultHarnessConfig.riskTierRules.medium]),
      low: z.array(z.string().trim().min(1)).default([...defaultHarnessConfig.riskTierRules.low]),
    })
    .default(defaultHarnessConfig.riskTierRules),
  mergePolicy: z
    .object({
      high: mergePolicyEntrySchema.default({ ...defaultHarnessConfig.mergePolicy.high }),
      medium: mergePolicyEntrySchema.default({ ...defaultHarnessConfig.mergePolicy.medium }),
      low: mergePolicyEntrySchema.default({ ...defaultHarnessConfig.mergePolicy.low }),
    })
    .default(defaultHarnessConfig.mergePolicy),
  docsDriftRules: z
    .object({
      triggers: z.record(z.array(z.string().trim().min(1))).default({}),
      message: z.string().trim().min(1).default(defaultHarnessConfig.docsDriftRules.message),
    })
    .default(defaultHarnessConfig.docsDriftRules),
  evidenceRequirements: z.record(z.string().trim().min(1)).default({}),
  harnessGap: z
    .object({
      slaHours: z.number().int().positive().default(defaultHarnessConfig.harnessGap.slaHours),
      labelPrefix: z.string().trim().min(1).default(defaultHarnessConfig.harnessGap.labelPrefix),
    })
    .default(defaultHarnessConfig.harnessGap),
});

export interface LoadHarnessConfigOptions {
  allowMissing?: boolean;
  cwd?: string;
  filePath?: string;
}

export type HarnessConfig = z.infer<typeof harnessConfigSchema>;

export function resolveHarnessConfigPath(cwd = process.cwd()): string {
  return resolve(join(cwd, "harness.config.json"));
}

export function parseHarnessConfig(input: unknown): HarnessConfig {
  return harnessConfigSchema.parse(input);
}

export function loadHarnessConfig(options: LoadHarnessConfigOptions = {}): HarnessConfig {
  const configPath = options.filePath
    ? resolve(options.filePath)
    : resolveHarnessConfigPath(options.cwd);

  if (!existsSync(configPath)) {
    if (options.allowMissing) {
      return harnessConfigSchema.parse(defaultHarnessConfig);
    }

    throw new Error(`[Harness Config] Config file not found: ${configPath}`);
  }

  return parseHarnessConfig(JSON.parse(readFileSync(configPath, "utf8")));
}
