import { getTypesenseConfig } from "../../lib/typesense";
import { TYPESENSE_CANDIDATES_SCHEMA, TYPESENSE_JOBS_SCHEMA } from "./typesense-schema";

type TypesenseMethod = "GET" | "POST" | "PUT" | "DELETE";
export type TypesenseCollection = "jobs" | "candidates";
type TypesenseCollectionState = "unknown" | "exists" | "missing";

type TypesenseRequestOptions = {
  body?: BodyInit;
  headers?: Record<string, string>;
  method?: TypesenseMethod;
  searchParams?: URLSearchParams;
  skipNotFound?: boolean;
};

type TypesenseCollectionCacheEntry = {
  bootstrapPromise?: Promise<void>;
  state: TypesenseCollectionState;
};

const collectionBootstrapCache = new Map<string, TypesenseCollectionCacheEntry>();

export class TypesenseRequestError extends Error {
  body: string;
  status: number;

  constructor(status: number, body: string) {
    super(`Typesense request failed (${status}): ${body}`);
    this.name = "TypesenseRequestError";
    this.body = body;
    this.status = status;
  }
}

function getCollectionSchema(collection: TypesenseCollection, name: string) {
  if (collection === "jobs") {
    return { ...TYPESENSE_JOBS_SCHEMA, name };
  }

  return { ...TYPESENSE_CANDIDATES_SCHEMA, name };
}

function getCollectionCacheContext(collection: TypesenseCollection) {
  const config = getTypesenseConfig();
  if (!config) return null;

  const collectionName = config.collections[collection];
  const cacheKey = `${collection}:${collectionName}`;
  const cacheEntry = collectionBootstrapCache.get(cacheKey) ?? { state: "unknown" as const };

  if (!collectionBootstrapCache.has(cacheKey)) {
    collectionBootstrapCache.set(cacheKey, cacheEntry);
  }

  return { cacheEntry, cacheKey, collectionName };
}

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
    throw new TypesenseRequestError(response.status, text);
  }

  if (response.status === 204) {
    return null;
  }

  // Typesense /documents/import returns NDJSON (one JSON per line),
  // which can't be parsed with response.json(). Detect and handle it.
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (contentType.includes("text/plain") || text.includes("\n{")) {
    // NDJSON response — parse each line and return as array
    const lines = text.trim().split("\n").filter(Boolean);
    return lines.map((line) => JSON.parse(line)) as T;
  }

  return JSON.parse(text) as T;
}

export function isTypesenseCollectionKnownMissing(collection: TypesenseCollection) {
  return getCollectionCacheContext(collection)?.cacheEntry.state === "missing";
}

export function markTypesenseCollectionMissing(collection: TypesenseCollection) {
  const context = getCollectionCacheContext(collection);
  if (!context) return;

  context.cacheEntry.bootstrapPromise = undefined;
  context.cacheEntry.state = "missing";
}

function markTypesenseCollectionExists(collection: TypesenseCollection) {
  const context = getCollectionCacheContext(collection);
  if (!context) return;

  context.cacheEntry.bootstrapPromise = undefined;
  context.cacheEntry.state = "exists";
}

export function resetTypesenseCollectionCache(collection?: TypesenseCollection) {
  if (!collection) {
    collectionBootstrapCache.clear();
    return;
  }

  const context = getCollectionCacheContext(collection);
  if (!context) return;

  collectionBootstrapCache.delete(context.cacheKey);
}

export function isTypesenseCollectionMissingError(error: unknown) {
  if (!(error instanceof TypesenseRequestError)) return false;
  if (error.status !== 404) return false;

  const normalizedBody = error.body.toLocaleLowerCase("en-US");
  return normalizedBody.includes("collection") || normalizedBody.includes("not found");
}

/** Drop a Typesense collection so it can be recreated fresh (used by reindex). */
export async function dropTypesenseCollection(collection: TypesenseCollection) {
  const config = getTypesenseConfig();
  if (!config) return;

  const collectionName = config.collections[collection];
  await typesenseRequest(`/collections/${collectionName}`, {
    method: "DELETE",
    skipNotFound: true,
  });

  markTypesenseCollectionMissing(collection);
}

export async function ensureTypesenseCollection(collection: TypesenseCollection) {
  const context = getCollectionCacheContext(collection);
  if (!context) return;

  if (context.cacheEntry.state === "exists") {
    return;
  }

  if (context.cacheEntry.bootstrapPromise) {
    return context.cacheEntry.bootstrapPromise;
  }

  const promise = (async () => {
    const found = await typesenseRequest(`/collections/${context.collectionName}`, {
      skipNotFound: true,
    });
    if (!found) {
      await typesenseRequest("/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getCollectionSchema(collection, context.collectionName)),
      });
    }

    markTypesenseCollectionExists(collection);
  })();

  context.cacheEntry.bootstrapPromise = promise;
  collectionBootstrapCache.set(context.cacheKey, context.cacheEntry);

  try {
    await promise;
  } catch (err) {
    if (context.cacheEntry.bootstrapPromise === promise) {
      context.cacheEntry.bootstrapPromise = undefined;
      context.cacheEntry.state = "unknown";
    }
    throw err;
  } finally {
    if (context.cacheEntry.bootstrapPromise === promise) {
      context.cacheEntry.bootstrapPromise = undefined;
    }
  }
}

export async function ensureTypesenseCollections() {
  if (!getTypesenseConfig()) return;

  await Promise.all([ensureTypesenseCollection("jobs"), ensureTypesenseCollection("candidates")]);
}
