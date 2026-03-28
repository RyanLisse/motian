import { getTypesenseConfig } from "../../lib/typesense";
import { TYPESENSE_CANDIDATES_SCHEMA, TYPESENSE_JOBS_SCHEMA } from "./typesense-schema";

type TypesenseMethod = "GET" | "POST" | "PUT" | "DELETE";

type TypesenseRequestOptions = {
  body?: BodyInit;
  headers?: Record<string, string>;
  method?: TypesenseMethod;
  searchParams?: URLSearchParams;
  skipNotFound?: boolean;
};

const ensuredCollections = new Map<string, Promise<void>>();

function buildUrl(path: string, searchParams?: URLSearchParams) {
  const config = getTypesenseConfig();
  if (!config) {
    throw new Error("Typesense is niet geconfigureerd.");
  }

  const baseUrl = config.url.endsWith("/") ? config.url : `${config.url}/`;
  const url = new URL(path.replace(/^\//, ""), baseUrl);
  if (searchParams) {
    url.search = searchParams.toString();
  }
  return { config, url };
}

export async function typesenseRequest<T>(
  path: string,
  options: TypesenseRequestOptions = {},
): Promise<T | null> {
  const { config, url } = buildUrl(path, options.searchParams);
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "X-TYPESENSE-API-KEY": config.apiKey,
      ...options.headers,
    },
    body: options.body,
  });

  if (options.skipNotFound && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Typesense request failed (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return (await response.json()) as T;
}

function getCollectionSchema(collection: "jobs" | "candidates", name: string) {
  if (collection === "jobs") {
    return { ...TYPESENSE_JOBS_SCHEMA, name };
  }

  return { ...TYPESENSE_CANDIDATES_SCHEMA, name };
}

/** Drop a Typesense collection so it can be recreated fresh (used by reindex). */
export async function dropTypesenseCollection(collection: "jobs" | "candidates") {
  const config = getTypesenseConfig();
  if (!config) return;

  const collectionName = config.collections[collection];
  await typesenseRequest(`/collections/${collectionName}`, {
    method: "DELETE",
    skipNotFound: true,
  });

  // Clear the memoized bootstrap promise so ensureTypesenseCollection recreates it.
  for (const [key] of ensuredCollections) {
    if (key.startsWith(`${collection}:`)) ensuredCollections.delete(key);
  }
}

export async function ensureTypesenseCollection(collection: "jobs" | "candidates") {
  const config = getTypesenseConfig();
  if (!config) return;

  const collectionName = config.collections[collection];
  const cacheKey = `${collection}:${collectionName}`;

  const existing = ensuredCollections.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const found = await typesenseRequest(`/collections/${collectionName}`, { skipNotFound: true });
    if (!found) {
      await typesenseRequest("/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getCollectionSchema(collection, collectionName)),
      });
    }
  })();

  ensuredCollections.set(cacheKey, promise);

  try {
    await promise;
  } catch (err) {
    ensuredCollections.delete(cacheKey);
    throw err;
  }
}
