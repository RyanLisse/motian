import { and, db, desc, eq, isNull } from "../db";
import { type SavedSearch, savedSearches } from "../db/saved-searches-schema";

/** List all non-deleted saved searches, newest first. */
export async function listSavedSearches(): Promise<SavedSearch[]> {
  return db
    .select()
    .from(savedSearches)
    .where(isNull(savedSearches.deletedAt))
    .orderBy(desc(savedSearches.createdAt));
}

/** Create a new saved search filter. */
export async function createSavedSearch(
  name: string,
  filters: Record<string, unknown>,
): Promise<SavedSearch> {
  const [row] = await db.insert(savedSearches).values({ name, filters }).returning();
  return row;
}

/** Soft-delete a saved search by ID. Returns true if found, false otherwise. */
export async function deleteSavedSearch(id: string): Promise<boolean> {
  const rows = await db
    .update(savedSearches)
    .set({ deletedAt: new Date() })
    .where(and(eq(savedSearches.id, id), isNull(savedSearches.deletedAt)))
    .returning();
  return rows.length > 0;
}
