import { db, sql } from "../db";
import { platformSettings } from "../db/schema";
import { DEFAULT_SETTINGS, SETTING_DEFINITIONS, type SettingsPayload } from "../schemas/settings";

/** Retrieve all settings as a flat SettingsPayload object. Seeds defaults if empty. */
export async function getAllSettings(): Promise<SettingsPayload> {
  const rows = await db.select().from(platformSettings);

  if (rows.length === 0) {
    await seedDefaults();
    return { ...DEFAULT_SETTINGS };
  }

  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    if (row.key in result) {
      result[row.key] = row.value;
    }
  }

  return result as SettingsPayload;
}

/** Update settings by upserting changed keys in a single batch. Returns the updated payload. */
export async function updateSettings(payload: Partial<SettingsPayload>): Promise<SettingsPayload> {
  const entries = Object.entries(payload) as [keyof SettingsPayload, unknown][];

  const validEntries = entries.filter(([key]) => SETTING_DEFINITIONS[key]);

  if (validEntries.length > 0) {
    const now = new Date();
    const values = validEntries.map(([key, value]) => ({
      category: SETTING_DEFINITIONS[key].category,
      key,
      value,
      description: SETTING_DEFINITIONS[key].description,
      updatedAt: now,
    }));

    // Batch upsert: single INSERT ... ON CONFLICT for all settings at once
    await db
      .insert(platformSettings)
      .values(values)
      .onConflictDoUpdate({
        target: [platformSettings.category, platformSettings.key],
        set: {
          value: sql`excluded.value`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  return getAllSettings();
}

/** Seed all default settings into the database */
async function seedDefaults(): Promise<void> {
  const entries = Object.entries(DEFAULT_SETTINGS) as [keyof SettingsPayload, unknown][];

  const values = entries.map(([key, value]) => ({
    category: SETTING_DEFINITIONS[key].category,
    key,
    value,
    description: SETTING_DEFINITIONS[key].description,
  }));

  await db.insert(platformSettings).values(values).onConflictDoNothing();
}
