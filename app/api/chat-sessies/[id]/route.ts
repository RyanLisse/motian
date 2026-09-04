import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { parsePagination } from "@/src/lib/pagination";
import { deleteSession, getSession } from "@/src/services/chat-sessions";

type RouteParams = { params: Promise<{ id: string }> };

const querySchema = z.object({
  cursor: z.string().min(1).optional(),
});

export const GET = withApiHandler(
  async (req: Request, { params }: RouteParams) => {
    const { id } = await params;
    const url = new URL(req.url);
    const result = querySchema.safeParse({
      cursor: url.searchParams.get("cursor") ?? undefined,
    });

    if (!result.success) {
      return Response.json({ error: "Ongeldige parameters" }, { status: 400 });
    }

    const { limit } = parsePagination(url.searchParams, { limit: 20, maxLimit: 50 });
    const session = await getSession(id, {
      limit,
      cursor: result.data.cursor ?? null,
    });

    if (!session) {
      return Response.json({ error: "Sessie niet gevonden" }, { status: 404 });
    }

    return Response.json(session, {
      headers: { "Cache-Control": "private, no-store" },
    });
  },
  { logPrefix: "chat-sessies/[id] GET", rateLimit: { interval: 60_000, limit: 30 } },
);

export const DELETE = withApiHandler(
  async (_req: Request, { params }: RouteParams) => {
    const { id } = await params;
    const deleted = await deleteSession(id);
    if (!deleted) {
      return Response.json({ error: "Sessie niet gevonden" }, { status: 404 });
    }
    return Response.json(
      { success: true },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  { logPrefix: "chat-sessies/[id] DELETE", rateLimit: { interval: 60_000, limit: 10 } },
);
