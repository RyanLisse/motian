import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { parsePagination } from "@/src/lib/pagination";
import { isRetryableChatSessionDatabaseError, listSessions } from "@/src/services/chat-sessions";

const querySchema = z.object({
  cursor: z.string().min(1).optional(),
});

export const GET = withApiHandler(
  async (req: Request) => {
    const url = new URL(req.url);
    const result = querySchema.safeParse({
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    if (!result.success) {
      return Response.json({ error: "Ongeldige parameters" }, { status: 400 });
    }
    const { limit } = parsePagination(url.searchParams, { limit: 20, maxLimit: 50 });
    const params = result.data;

    const page = await listSessions({ limit, cursor: params.cursor ?? null }).catch((error) => {
      if (isRetryableChatSessionDatabaseError(error)) {
        console.warn("[chat-sessies] degraded empty response after retryable database error");
        return { sessions: [], nextCursor: null, hasMore: false };
      }

      throw error;
    });
    return Response.json(page, {
      headers: { "Cache-Control": "private, no-store" },
    });
  },
  { logPrefix: "chat-sessies", rateLimit: { interval: 60_000, limit: 30 } },
);
