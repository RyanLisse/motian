import { db } from "../db";
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

/** Update settings by upserting each changed key. Returns the updated payload. */
export async function updateSettings(payload: Partial<SettingsPayload>): Promise<SettingsPayload> {
  const entries = Object.entries(payload) as [keyof SettingsPayload, unknown][];

  for (const [key, value] of entries) {
    const def = SETTING_DEFINITIONS[key];
    if (!def) continue;

    await db
      .insert(platformSettings)
      .values({
        category: def.category,
        key,
        value,
        description: def.description,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [platformSettings.category, platformSettings.key],
        set: {
          value,
          updatedAt: new Date(),
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
