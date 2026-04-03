import { z } from "zod";

/** Valid setting categories */
export const settingCategorySchema = z.enum(["matching", "gegevensbeheer", "meldingen"]);
export type SettingCategory = z.infer<typeof settingCategorySchema>;

/** Flattened settings object sent to/from the frontend */
export const settingsPayloadSchema = z.object({
  // Matching
  minimumScoreThreshold: z.number().int().min(0).max(100),
  autoEnrichmentEnabled: z.boolean(),

  // Scoring weights (must sum to 100)
  scoringSkillWeight: z.number().int().min(0).max(100),
  scoringLocationWeight: z.number().int().min(0).max(100),
  scoringRateWeight: z.number().int().min(0).max(100),
  scoringRoleWeight: z.number().int().min(0).max(100),

  // Auto-match config
  autoMatchTopN: z.number().int().min(1).max(50),
  autoMatchMinScore: z.number().int().min(0).max(100),

  // Search config
  searchVectorMinScore: z.number().min(0).max(1),

  // Gegevensbeheer
  gdprRetentionDays: z.number().int().min(30).max(3650),
  autoCleanupEnabled: z.boolean(),

  // Meldingen
  slackNotificationsEnabled: z.boolean(),
  notifyOnScrapeErrors: z.boolean(),
});

export type SettingsPayload = z.infer<typeof settingsPayloadSchema>;

/** Default values seeded when no settings exist */
export const DEFAULT_SETTINGS: SettingsPayload = {
  minimumScoreThreshold: 60,
  autoEnrichmentEnabled: true,
  scoringSkillWeight: 40,
  scoringLocationWeight: 20,
  scoringRateWeight: 20,
  scoringRoleWeight: 20,
  autoMatchTopN: 3,
  autoMatchMinScore: 25,
  searchVectorMinScore: 0.3,
  gdprRetentionDays: 365,
  autoCleanupEnabled: false,
  slackNotificationsEnabled: false,
  notifyOnScrapeErrors: true,
};

/** Maps each key to its DB category and Dutch description */
export const SETTING_DEFINITIONS: Record<
  keyof SettingsPayload,
  { category: SettingCategory; description: string }
> = {
  minimumScoreThreshold: {
    category: "matching",
    description: "Minimale match-score drempel",
  },
  autoEnrichmentEnabled: {
    category: "matching",
    description: "Automatische verrijking van kandidaatprofielen",
  },
  scoringSkillWeight: {
    category: "matching",
    description: "Gewicht vaardigheden in scoring (0–100)",
  },
  scoringLocationWeight: {
    category: "matching",
    description: "Gewicht locatie in scoring (0–100)",
  },
  scoringRateWeight: {
    category: "matching",
    description: "Gewicht tarief in scoring (0–100)",
  },
  scoringRoleWeight: {
    category: "matching",
    description: "Gewicht rol in scoring (0–100)",
  },
  autoMatchTopN: {
    category: "matching",
    description: "Aantal top-resultaten bij automatisch matchen",
  },
  autoMatchMinScore: {
    category: "matching",
    description: "Minimale score voor automatisch matchen (%)",
  },
  searchVectorMinScore: {
    category: "matching",
    description: "Minimale vector-score bij semantisch zoeken (0–1)",
  },
  gdprRetentionDays: {
    category: "gegevensbeheer",
    description: "Standaard AVG-bewaartermijn in dagen",
  },
  autoCleanupEnabled: {
    category: "gegevensbeheer",
    description: "Automatisch opschonen van verlopen gegevens",
  },
  slackNotificationsEnabled: {
    category: "meldingen",
    description: "Slack-notificaties inschakelen",
  },
  notifyOnScrapeErrors: {
    category: "meldingen",
    description: "Melding bij scrape-fouten",
  },
};
