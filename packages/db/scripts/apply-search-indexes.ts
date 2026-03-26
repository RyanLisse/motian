import { Pool } from "pg";
import { config } from "dotenv";

config({ path: "../../.env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  {
    label: "1. Enable pg_trgm extension",
    sql: "CREATE EXTENSION IF NOT EXISTS pg_trgm;",
  },
  {
    label: "2. Add search_vector column",
    sql: "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS search_vector tsvector;",
  },
  {
    label: "3. Populate search_vector from search_text",
    sql: "UPDATE jobs SET search_vector = to_tsvector('dutch', coalesce(search_text, ''));",
  },
  {
    label: "4. GIN index on search_vector",
    sql: "CREATE INDEX IF NOT EXISTS idx_jobs_search_vector ON jobs USING gin(search_vector);",
  },
  {
    label: "5. pg_trgm GIN index on title",
    sql: "CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING gin(title gin_trgm_ops);",
  },
  {
    label: "6. pg_trgm GIN index on search_text",
    sql: "CREATE INDEX IF NOT EXISTS idx_jobs_search_text_trgm ON jobs USING gin(search_text gin_trgm_ops);",
  },
  {
    label: "7. Create trigger function",
    sql: `CREATE OR REPLACE FUNCTION jobs_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('dutch', coalesce(NEW.search_text, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;`,
  },
  {
    label: "8. Drop old trigger if exists",
    sql: "DROP TRIGGER IF EXISTS jobs_search_vector_trigger ON jobs;",
  },
  {
    label: "9. Create trigger",
    sql: "CREATE TRIGGER jobs_search_vector_trigger BEFORE INSERT OR UPDATE OF search_text ON jobs FOR EACH ROW EXECUTE FUNCTION jobs_search_vector_update();",
  },
];

async function main() {
  const client = await pool.connect();
  try {
    for (const { label, sql } of statements) {
      const start = Date.now();
      const result = await client.query(sql);
      const ms = Date.now() - start;
      console.log(`OK  ${label} (${ms}ms) rows: ${result.rowCount ?? "-"}`);
    }
    console.log("\nAll statements executed successfully.");

    // Verify with EXPLAIN ANALYZE
    console.log("\n--- EXPLAIN ANALYZE: Full-text search ---");
    const fts = await client.query(`
      EXPLAIN (ANALYZE, FORMAT TEXT)
      SELECT id, title FROM jobs
      WHERE search_vector @@ to_tsquery('dutch', 'software')
      AND deleted_at IS NULL AND status = 'open'
      LIMIT 20
    `);
    for (const row of fts.rows) {
      console.log(row["QUERY PLAN"]);
    }

    console.log("\n--- EXPLAIN ANALYZE: Trigram similarity ---");
    const trgm = await client.query(`
      EXPLAIN (ANALYZE, FORMAT TEXT)
      SELECT id, title, similarity(title, 'software') as sim
      FROM jobs
      WHERE title % 'software'
      ORDER BY sim DESC
      LIMIT 10
    `);
    for (const row of trgm.rows) {
      console.log(row["QUERY PLAN"]);
    }
  } catch (err) {
    console.error("ERROR:", (err as Error).message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
