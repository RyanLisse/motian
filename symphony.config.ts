/**
 * Symphony integration configuration.
 * Defines how OpenAI Symphony agents interact with this repository.
 *
 * @see https://docs.openai.com/symphony
 */
export const symphonyConfig = {
  /** Linear project reference for issue tracking */
  project: "motian-0ed97889acb8",

  /** Branch naming convention: symphony/<linear-issue-id>-<slug> */
  branchPattern: "symphony/{issueId}-{slug}",

  /** Merge policy — all CI checks must pass before auto-merge */
  mergePolicy: {
    requiredStatusChecks: ["Symphony Gate"],
    requireCodeReview: false,
    autoMergeEnabled: true,
    deleteBranchOnMerge: true,
  },

  /** File patterns Symphony agents are allowed to modify */
  allowedFilePatterns: [
    "src/**/*.ts",
    "src/**/*.tsx",
    "app/**/*.ts",
    "app/**/*.tsx",
    "tests/**/*.test.ts",
    "components/**/*.tsx",
    "components/**/*.ts",
  ],

  /** File patterns Symphony agents must NEVER modify */
  deniedFilePatterns: [
    "src/db/schema.ts",
    "src/db/index.ts",
    "drizzle/**",
    ".github/**",
    "harness.config.json",
    "*.config.ts",
    "*.config.js",
    "pnpm-lock.yaml",
  ],

  /** Risk tier reference — agents must check harness.config.json */
  harnessConfigPath: "harness.config.json",
} as const;

export type SymphonyConfig = typeof symphonyConfig;
