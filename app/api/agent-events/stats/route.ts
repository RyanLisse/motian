import { db, eq, gte, sql } from "@/src/db";
import { agentEvents } from "@/src/db/schema";
import { withApiHandler } from "@/src/lib/api-handler";

export const dynamic = "force-dynamic";

/** GET /api/agent-events/stats — aggregated agent metrics for the dashboard */
export const GET = withApiHandler(async () => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Run all queries in parallel
  const [
    eventsByAgent24h,
    eventsByType24h,
    statusCounts,
    eventsByAgent7d,
    totalEvents,
    recentErrors,
  ] = await Promise.all([
    // Events per agent in last 24h
    db
      .select({
        sourceAgent: agentEvents.sourceAgent,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(agentEvents)
      .where(gte(agentEvents.createdAt, twentyFourHoursAgo))
      .groupBy(agentEvents.sourceAgent),

    // Events per type in last 24h
    db
      .select({
        eventType: agentEvents.eventType,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(agentEvents)
      .where(gte(agentEvents.createdAt, twentyFourHoursAgo))
      .groupBy(agentEvents.eventType),

    // Current status distribution
    db
      .select({
        status: agentEvents.status,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(agentEvents)
      .groupBy(agentEvents.status),

    // Events per agent in last 7 days (daily breakdown)
    db
      .select({
        sourceAgent: agentEvents.sourceAgent,
        day: sql<string>`to_char(${agentEvents.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(agentEvents)
      .where(gte(agentEvents.createdAt, sevenDaysAgo))
      .groupBy(agentEvents.sourceAgent, sql`to_char(${agentEvents.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${agentEvents.createdAt}, 'YYYY-MM-DD')`),

    // Total events all time
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(agentEvents)
      .then((r) => r[0]?.count ?? 0),

    // Recent errors (last 10)
    db
      .select({
        id: agentEvents.id,
        sourceAgent: agentEvents.sourceAgent,
        eventType: agentEvents.eventType,
        errorMessage: agentEvents.errorMessage,
        createdAt: agentEvents.createdAt,
      })
      .from(agentEvents)
      .where(eq(agentEvents.status, "failed"))
      .orderBy(sql`${agentEvents.createdAt} desc`)
      .limit(10),
  ]);

  // Derive KPIs
  const pendingCount = statusCounts.find((s) => s.status === "pending")?.count ?? 0;
  const completedCount = statusCounts.find((s) => s.status === "completed")?.count ?? 0;
  const failedCount = statusCounts.find((s) => s.status === "failed")?.count ?? 0;
  const total24h = eventsByAgent24h.reduce((sum, a) => sum + a.count, 0);

  return Response.json({
    data: {
      kpi: {
        totalEvents,
        eventsLast24h: total24h,
        pendingCount,
        completedCount,
        failedCount,
        successRate:
          completedCount + failedCount > 0
            ? Math.round((completedCount / (completedCount + failedCount)) * 100)
            : 100,
      },
      eventsByAgent24h,
      eventsByType24h,
      eventsByAgent7d,
      statusCounts,
      recentErrors,
    },
  });
});
