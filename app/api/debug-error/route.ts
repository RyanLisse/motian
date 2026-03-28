import { db, sql } from "@/src/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? "SET" : "MISSING",
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  // Test DB connection
  try {
    const result = await db.execute(sql`SELECT 1 as ok`);
    diagnostics.db = { connected: true, result: result.rows[0] };
  } catch (e) {
    diagnostics.db = {
      connected: false,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5) : undefined,
    };
  }

  // Test importing sidebar-metadata (the function used in root layout)
  try {
    const { getSidebarMetadata } = await import("@/src/services/sidebar-metadata");
    const meta = await getSidebarMetadata();
    diagnostics.sidebar = { ok: true, hasData: !!meta };
  } catch (e) {
    diagnostics.sidebar = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5) : undefined,
    };
  }

  // Test importing the schema
  try {
    const schema = await import("@/src/db/schema");
    diagnostics.schema = {
      ok: true,
      tables: Object.keys(schema).filter((k) => !k.startsWith("_")),
    };
  } catch (e) {
    diagnostics.schema = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return Response.json(diagnostics, {
    status: 200,
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
