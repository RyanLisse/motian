import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { type AgentEventType, type AgentName, getRecentEvents } from "@/src/services/agent-events";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  sourceAgent: z.string().optional(),
  eventType: z.string().optional(),
});

/** GET /api/agent-events — activity feed for agent events */
export const GET = withApiHandler(async (request: Request) => {
  const url = new URL(request.url);
  const params = querySchema.parse({
    limit: url.searchParams.get("limit") ?? 50,
    sourceAgent: url.searchParams.get("sourceAgent") ?? undefined,
    eventType: url.searchParams.get("eventType") ?? undefined,
  });

  const events = await getRecentEvents({
    limit: params.limit,
    sourceAgent: params.sourceAgent as AgentName | undefined,
    eventType: params.eventType as AgentEventType | undefined,
  });

  return Response.json(
    { data: events, count: events.length },
    {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    },
  );
});
