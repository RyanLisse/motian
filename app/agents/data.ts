import { cache } from "react";
import { db, desc, gte, sql } from "@/src/db";
import { agentEvents } from "@/src/db/schema";

export const getAgentDashboardData = cache(async function getAgentDashboardData() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [totalEvents, events24h, statusCounts, agentCounts24h, typeCounts24h, recentEvents] =
    await Promise.all([
      db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(agentEvents)
        .then((r) => r[0]?.count ?? 0),

      db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(agentEvents)
        .where(gte(agentEvents.createdAt, twentyFourHoursAgo))
        .then((r) => r[0]?.count ?? 0),

      db
        .select({
          status: agentEvents.status,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(agentEvents)
        .groupBy(agentEvents.status),

      db
        .select({
          sourceAgent: agentEvents.sourceAgent,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(agentEvents)
        .where(gte(agentEvents.createdAt, twentyFourHoursAgo))
        .groupBy(agentEvents.sourceAgent),

      db
        .select({
          eventType: agentEvents.eventType,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(agentEvents)
        .where(gte(agentEvents.createdAt, twentyFourHoursAgo))
        .groupBy(agentEvents.eventType),

      db.select().from(agentEvents).orderBy(desc(agentEvents.createdAt)).limit(5),
    ]);

  const pending =
    statusCounts.find((s: { status: string; count: number }) => s.status === "pending")?.count ?? 0;
  const completed =
    statusCounts.find((s: { status: string; count: number }) => s.status === "completed")?.count ??
    0;
  const failed =
    statusCounts.find((s: { status: string; count: number }) => s.status === "failed")?.count ?? 0;

  return {
    kpi: {
      totalEvents,
      events24h,
      pending,
      completed,
      failed,
      successRate:
        completed + failed > 0 ? Math.round((completed / (completed + failed)) * 100) : 100,
    },
    agentCounts24h: Object.fromEntries(
      agentCounts24h.map((a: { sourceAgent: string; count: number }) => [a.sourceAgent, a.count]),
    ),
    typeCounts24h: Object.fromEntries(
      typeCounts24h.map((t: { eventType: string; count: number }) => [t.eventType, t.count]),
    ),
    recentEvents,
  };
});
