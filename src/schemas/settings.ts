import { z } from "zod";

/** Valid setting categories */
export const settingCategorySchema = z.enum(["matching", "gegevensbeheer", "meldingen"]);
export type SettingCategory = z.infer<typeof settingCategorySchema>;

/** Flattened settings object sent to/from the frontend */
export const settingsPayloadSchema = z.object({
  // Matching
  minimumScoreThreshold: z.number().int().min(0).max(100),
  autoEnrichmentEnabled: z.boolean(),

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
