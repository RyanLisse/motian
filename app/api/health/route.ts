export const dynamic = "force-dynamic";

/**
 * Container liveness probe (RJC-419).
 *
 * Deliberately does no database work. The Docker HEALTHCHECK runs this every
 * 30s, and a probe that touches Neon would let a transient database blip
 * restart a container whose process is perfectly healthy — turning a brief
 * degradation into a restart loop.
 *
 * `/api/gezondheid` stays the deep readiness view: it reports scraper and
 * database state for operators, and is expected to fail loudly when they are
 * broken.
 */
export function GET(): Response {
  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
