import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { paginatedResponse, parsePagination } from "@/src/lib/pagination";
import {
  type AgentEventType,
  type AgentName,
  countRecentEvents,
  getRecentEvents,
} from "@/src/services/agent-events";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  sourceAgent: z.string().optional(),
  eventType: z.string().optional(),
});

/** GET /api/agent-events — activity feed for agent events */
export const GET = withApiHandler(async (request: Request) => {
  const url = new URL(request.url);
  const { page, limit, offset } = parsePagination(url.searchParams, { maxLimit: 200 });
  const params = querySchema.parse({
    limit,
    sourceAgent: url.searchParams.get("sourceAgent") ?? undefined,
    eventType: url.searchParams.get("eventType") ?? undefined,
  });

  const sourceAgent = params.sourceAgent as AgentName | undefined;
  const eventType = params.eventType as AgentEventType | undefined;

  const [events, total] = await Promise.all([
    getRecentEvents({
      limit: params.limit,
      offset,
      sourceAgent,
      eventType,
    }),
    countRecentEvents({ sourceAgent, eventType }),
  ]);

  return Response.json(paginatedResponse(events, total, { page, limit: params.limit, offset }), {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
});
