/**
 * Build the jobs schema dynamically so the OpenAI embedding field is only
 * included when an API key is available. Without the key, Typesense would
 * reject every document import because it can't call OpenAI.
 */
export function buildTypesenseJobsSchema(openaiApiKey?: string) {
  const fields: Record<string, unknown>[] = [
    { name: "id", type: "string" },
    { name: "title", type: "string" },
    { name: "searchText", type: "string" },
    { name: "platform", type: "string", facet: true, optional: true },
    { name: "company", type: "string", facet: true, optional: true },
    { name: "endClient", type: "string", facet: true, optional: true },
    { name: "status", type: "string", facet: true, optional: true },
    { name: "province", type: "string", facet: true, optional: true },
    { name: "contractType", type: "string", facet: true, optional: true },
    { name: "workArrangement", type: "string", facet: true, optional: true },
    { name: "categories", type: "string[]", facet: true, optional: true },
    { name: "rateMin", type: "int32", optional: true, sort: true },
    { name: "rateMax", type: "int32", optional: true, sort: true },
    { name: "hoursPerWeek", type: "int32", optional: true, sort: true },
    { name: "minHoursPerWeek", type: "int32", optional: true, sort: true },
    { name: "applicationDeadlineTs", type: "int64", optional: true, sort: true },
    { name: "postedAtTs", type: "int64", optional: true, sort: true },
    { name: "startDateTs", type: "int64", optional: true, sort: true },
    { name: "scrapedAtTs", type: "int64", sort: true },
  ];

  // Auto-embedding via OpenAI — enables hybrid (keyword + semantic) search
  // in a single Typesense query, eliminating the separate pgvector leg.
  if (openaiApiKey) {
    fields.push({
      name: "embedding",
      type: "float[]",
      embed: {
        from: ["title", "searchText"],
        model_config: {
          model_name: "openai/text-embedding-3-small",
          api_key: openaiApiKey,
          dimensions: 512,
        },
      },
    });
  }

  return {
    name: "jobs",
    enable_nested_fields: false,
    fields,
    default_sorting_field: "scrapedAtTs",
  };
}

/** Static schema for backwards compatibility (no embedding). */
export const TYPESENSE_JOBS_SCHEMA = buildTypesenseJobsSchema();

export const TYPESENSE_CANDIDATES_SCHEMA = {
  name: "candidates",
  enable_nested_fields: false,
  fields: [
    { name: "id", type: "string" },
    { name: "name", type: "string" },
    { name: "role", type: "string", optional: true },
    { name: "location", type: "string", optional: true },
    { name: "skills", type: "string[]", optional: true },
    { name: "searchText", type: "string" },
    { name: "matchingStatus", type: "string", facet: true, optional: true },
    { name: "createdAtTs", type: "int64", sort: true },
    { name: "updatedAtTs", type: "int64", optional: true, sort: true },
  ],
  default_sorting_field: "createdAtTs",
} as const;
