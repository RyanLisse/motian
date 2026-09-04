import { db, sql } from "@/src/db";
import { requirePrincipal } from "@/src/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Non-production diagnostics only. Payload is booleans / coarse enums — never
 * exception messages, stack fragments, schema inventory, or env values.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Niet gevonden" }, { status: 404 });
  }

  const principalOrResponse = await requirePrincipal(request);
  if (principalOrResponse instanceof Response) {
    return principalOrResponse;
  }

  // Past the production early-return: NODE_ENV is narrowed away from "production".
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeEnv: "non-production",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  };

  try {
    await db.execute(sql`SELECT 1 as ok`);
    diagnostics.db = { connected: true };
  } catch {
    diagnostics.db = { connected: false };
  }

  try {
    const { getSidebarMetadata } = await import("@/src/services/sidebar-metadata");
    const meta = await getSidebarMetadata();
    diagnostics.sidebar = { ok: true, hasData: Boolean(meta) };
  } catch {
    diagnostics.sidebar = { ok: false };
  }

  try {
    await import("@/src/db/schema");
    diagnostics.schema = { ok: true };
  } catch {
    diagnostics.schema = { ok: false };
  }

  return Response.json(diagnostics, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
