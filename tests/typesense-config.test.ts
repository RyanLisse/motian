import { describe, expect, it } from "vitest";

import {
  getTypesenseCollectionNames,
  getTypesenseConfig,
  isTypesenseEnabled,
} from "../src/lib/typesense";

describe("typesense config", () => {
  it("stays disabled when required env vars are missing", () => {
    const env = {};

    expect(isTypesenseEnabled(env)).toBe(false);
    expect(getTypesenseConfig(env)).toBeNull();
  });

  it("enables Typesense when url and api key are present", () => {
    const env = {
      TYPESENSE_URL: "https://typesense.example.com",
      TYPESENSE_API_KEY: "secret-key",
    };

    expect(isTypesenseEnabled(env)).toBe(true);
    expect(getTypesenseConfig(env)).toEqual({
      url: "https://typesense.example.com",
      apiKey: "secret-key",
      collections: {
        jobs: "jobs",
        candidates: "candidates",
      },
    });
  });

  it("supports custom collection names", () => {
    const env = {
      TYPESENSE_URL: "https://typesense.example.com",
      TYPESENSE_API_KEY: "secret-key",
      TYPESENSE_JOBS_COLLECTION: "motian_jobs_preview",
      TYPESENSE_CANDIDATES_COLLECTION: "motian_candidates_preview",
    };

    expect(getTypesenseCollectionNames(env)).toEqual({
      jobs: "motian_jobs_preview",
      candidates: "motian_candidates_preview",
    });
  });
});
