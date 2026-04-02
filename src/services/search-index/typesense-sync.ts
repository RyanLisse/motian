import { and, db, inArray, isNull } from "../../db";
import { candidates, jobs } from "../../db/schema";
import { getTypesenseConfig, isTypesenseEnabled } from "../../lib/typesense";
import { getVisibleVacancyCondition } from "../jobs/filters";
import { ensureTypesenseCollection, typesenseRequest } from "./typesense-client";
import { toTypesenseCandidateDocument, toTypesenseJobDocument } from "./typesense-documents";

function chunk<T>(items: T[], size = 25): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

async function importDocuments(collection: "jobs" | "candidates", documents: object[]) {
  if (!isTypesenseEnabled() || documents.length === 0) return;

  await ensureTypesenseCollection(collection);
  const config = getTypesenseConfig();
  if (!config) return;

  const payload = documents.map((document) => JSON.stringify(document)).join("\n");
  await typesenseRequest(`/collections/${config.collections[collection]}/documents/import`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    searchParams: new URLSearchParams({ action: "upsert" }),
    body: payload,
  });
}

async function deleteDocuments(collection: "jobs" | "candidates", ids: string[]) {
  if (!isTypesenseEnabled() || ids.length === 0) return;

  await ensureTypesenseCollection(collection);
  const config = getTypesenseConfig();
  if (!config) return;

  await Promise.all(
    ids.map((id) =>
      typesenseRequest(
        `/collections/${config.collections[collection]}/documents/${encodeURIComponent(id)}`,
        { method: "DELETE", skipNotFound: true },
      ),
    ),
  );
}

export async function ensureTypesenseCollections() {
  if (!isTypesenseEnabled()) return;
  await Promise.all([ensureTypesenseCollection("jobs"), ensureTypesenseCollection("candidates")]);
}

export async function upsertJobsByIds(ids: string[]) {
  if (!isTypesenseEnabled() || ids.length === 0) return;

  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      searchText: jobs.searchText,
      platform: jobs.platform,
      company: jobs.company,
      endClient: jobs.endClient,
      status: jobs.status,
      province: jobs.province,
      contractType: jobs.contractType,
      workArrangement: jobs.workArrangement,
      categories: jobs.categories,
      rateMin: jobs.rateMin,
      rateMax: jobs.rateMax,
      hoursPerWeek: jobs.hoursPerWeek,
      minHoursPerWeek: jobs.minHoursPerWeek,
      applicationDeadline: jobs.applicationDeadline,
      postedAt: jobs.postedAt,
      startDate: jobs.startDate,
      scrapedAt: jobs.scrapedAt,
    })
    .from(jobs)
    .where(and(inArray(jobs.id, ids), getVisibleVacancyCondition()));

  const existingIds = new Set(rows.map((row) => row.id));
  const missingIds = ids.filter((id) => !existingIds.has(id));

  for (const batch of chunk(rows)) {
    await importDocuments(
      "jobs",
      batch.map((row) =>
        toTypesenseJobDocument({
          ...row,
          categories: asStringArray(row.categories),
        }),
      ),
    );
  }

  if (missingIds.length > 0) {
    await deleteDocuments("jobs", missingIds);
  }
}

export async function deleteJobsByIds(ids: string[]) {
  await deleteDocuments("jobs", ids);
}

export async function upsertCandidatesByIds(ids: string[]) {
  if (!isTypesenseEnabled() || ids.length === 0) return;

  const rows = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      role: candidates.role,
      location: candidates.location,
      skills: candidates.skills,
      availability: candidates.availability,
      matchingStatus: candidates.matchingStatus,
      createdAt: candidates.createdAt,
      updatedAt: candidates.updatedAt,
    })
    .from(candidates)
    .where(and(inArray(candidates.id, ids), isNull(candidates.deletedAt)));

  const existingIds = new Set(rows.map((row) => row.id));
  const missingIds = ids.filter((id) => !existingIds.has(id));

  for (const batch of chunk(rows)) {
    await importDocuments(
      "candidates",
      batch.map((row) =>
        toTypesenseCandidateDocument({
          ...row,
          skills: asStringArray(row.skills),
        }),
      ),
    );
  }

  if (missingIds.length > 0) {
    await deleteDocuments("candidates", missingIds);
  }
}

export async function deleteCandidatesByIds(ids: string[]) {
  await deleteDocuments("candidates", ids);
}
