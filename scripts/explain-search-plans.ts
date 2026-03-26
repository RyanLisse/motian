/**
 * Capture baseline PostgreSQL explain plans for the core vacature-search paths.
 *
 * Run with:
 *   pnpm metrics:search-explain
 *
 * Requires DATABASE_URL (for example via `.env.local`).
 * Writes output to `docs/metrics/search-path-explain-latest.json`.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { config as dotenvConfig } from "dotenv";
import { and, type SQL, sql } from "drizzle-orm";
import { db } from "../src/db";
import { jobs } from "../src/db/schema";
import { caseInsensitiveContains, toTsQueryInput } from "../src/lib/helpers";
import { LIST_SLO_MS, type QueryPath, SEARCH_SLO_MS } from "../src/lib/query-observability";
import {
  buildDedupedJobsCte,
  getDeduplicationPartitionExpressions,
  getListSortOrderSql,
} from "../src/services/jobs/deduplication";
import { buildJobFilterConditions } from "../src/services/jobs/query-filters";

dotenvConfig({ path: ".env.local" });

type ExplainPlan = {
  path: string;
  pathLabel: QueryPath;
  query: string;
  raw: unknown;
};

function extractPlan(rawResult: Array<Record<string, unknown>>): unknown {
  if (rawResult.length === 0) return null;

  const firstRow = rawResult[0] as Record<string, unknown>;
  const value = firstRow[Object.keys(firstRow)[0] ?? ""];

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function runExplain(sqlQuery: SQL): Promise<{ rows: Array<Record<string, unknown>> }> {
  return (
    db as unknown as { execute: (query: SQL) => Promise<{ rows: Array<Record<string, unknown>> }> }
  ).execute(sql`
    EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)
    ${sqlQuery}
  `);
}

function captureDedupedQueryPlan({
  pathLabel,
  queryLabel,
  whereClause,
  sortOrder,
  extraSelections,
  limit = 25,
  offset = 0,
}: {
  pathLabel: QueryPath;
  queryLabel: string;
  whereClause: SQL;
  sortOrder: ReturnType<typeof getListSortOrderSql>;
  extraSelections?: SQL;
  limit?: number;
  offset?: number;
}): Promise<ExplainPlan> {
  const cte = buildDedupedJobsCte({
    whereClause,
    partitionOrderBy: sortOrder.partitionOrderBy,
    deduplicationPartitionExpressions: getDeduplicationPartitionExpressions("normalized"),
    extraSelections,
    preFetchLimit: Math.min((offset + limit) * 5, 500),
  });
  const planQuery = sql`
    ${cte}
    select id, cast(count(*) over() as integer) as total
    from deduped_jobs
    order by ${sortOrder.resultOrderBy}
    limit ${limit}
    offset ${offset}
  `;

  return runExplain(planQuery).then((result) => ({
    path: "deduped_jobs list + order + pagination",
    pathLabel,
    query: queryLabel,
    raw: extractPlan(result.rows),
  }));
}

function createDimensionVector(dimension: number): number[] {
  return Array.from({ length: dimension }, (_, index) => {
    if (index === 0) return 1;
    return 0.25 + (index % 3) * 0.1;
  });
}

function vectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

async function capturePlans() {
  const whereClause = and(...buildJobFilterConditions({ status: "open" }));
  const sortOrder = getListSortOrderSql("nieuwste");
  const limit = 25;
  const offset = 0;
  const plans: ExplainPlan[] = [];

  plans.push(
    await captureDedupedQueryPlan({
      pathLabel: "list",
      queryLabel:
        "listJobs({ limit: 25, offset: 0, status: open }) with deduped_jobs CTE + deterministic sort",
      whereClause,
      sortOrder,
      limit,
      offset,
    }),
  );

  const searchTextQuery = toTsQueryInput("developer");
  if (searchTextQuery) {
    plans.push(
      await captureDedupedQueryPlan({
        pathLabel: "list-fts",
        queryLabel:
          "searchJobsUnified({ q: developer, ... }, list mode) + to_tsquery(prepared searchText) + dedupe",
        whereClause: and(
          whereClause,
          sql`search_vector @@ to_tsquery('dutch', ${searchTextQuery})`,
        ),
        sortOrder,
        extraSelections: sql`ts_rank(search_vector, to_tsquery('dutch', ${searchTextQuery})) as search_rank`,
        limit,
        offset,
      }),
    );
  }

  plans.push(
    await captureDedupedQueryPlan({
      pathLabel: "search-text",
      queryLabel:
        "searchJobIdsByTitle({ q: developer, status: open }) with dedupe and title ILIKE fallback",
      whereClause: and(whereClause, caseInsensitiveContains(jobs.title, "developer")),
      sortOrder,
      limit,
      offset,
    }),
  );

  const vector = vectorLiteral(createDimensionVector(512));
  const vectorPlan = await runExplain(sql`
    SELECT
      id,
      1 - (embedding <=> ${vector}::vector) AS similarity
    FROM jobs
    WHERE ${and(
      sql`embedding IS NOT NULL`,
      whereClause,
      sql`1 - (embedding <=> ${vector}::vector) >= 0.3`,
    )}
    ORDER BY embedding <=> ${vector}::vector
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  plans.push({
    path: "hybrid vector candidate search",
    pathLabel: "search-hybrid",
    query:
      "hybrid vector fallback candidate search with pre-normalized open-job filter and cosine threshold",
    raw: extractPlan(vectorPlan.rows),
  });

  return plans;
}

async function main() {
  const explainPlans = await capturePlans();

  const payload = {
    generatedAt: new Date().toISOString(),
    queryBenchmarks: {
      searchSLOms: SEARCH_SLO_MS,
      listSLOms: LIST_SLO_MS,
    },
    plans: explainPlans,
  };

  const outDir = path.join(process.cwd(), "docs", "metrics");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "search-path-explain-latest.json");
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
