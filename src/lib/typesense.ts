export type TypesenseCollectionNames = {
  jobs: string;
  candidates: string;
};

export type TypesenseConfig = {
  url: string;
  apiKey: string;
  collections: TypesenseCollectionNames;
};

const DEFAULT_TYPESENSE_COLLECTIONS: TypesenseCollectionNames = {
  jobs: "jobs",
  candidates: "candidates",
};

function normalizeEnvValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function getTypesenseCollectionNames(
  env: NodeJS.ProcessEnv = process.env,
): TypesenseCollectionNames {
  return {
    jobs: normalizeEnvValue(env.TYPESENSE_JOBS_COLLECTION) ?? DEFAULT_TYPESENSE_COLLECTIONS.jobs,
    candidates:
      normalizeEnvValue(env.TYPESENSE_CANDIDATES_COLLECTION) ??
      DEFAULT_TYPESENSE_COLLECTIONS.candidates,
  };
}

export function getTypesenseConfig(env: NodeJS.ProcessEnv = process.env): TypesenseConfig | null {
  const url = normalizeEnvValue(env.TYPESENSE_URL);
  const apiKey = normalizeEnvValue(env.TYPESENSE_API_KEY);

  if (!url || !apiKey) {
    return null;
  }

  return {
    url,
    apiKey,
    collections: getTypesenseCollectionNames(env),
  };
}

export function isTypesenseEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getTypesenseConfig(env) !== null;
}
