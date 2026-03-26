import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { deleteSession, getSession } from "@/src/services/chat-sessions";

type RouteParams = { params: Promise<{ sessionId: string }> };

const querySchema = z.object({
  limit: z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }, z.coerce.number().int().min(1).max(50).default(20)),
  cursor: z.string().min(1).optional(),
});

export const GET = withApiHandler(
  async (req: Request, { params }: RouteParams) => {
    const { sessionId } = await params;
    const url = new URL(req.url);
    const result = querySchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });

    if (!result.success) {
      return Response.json({ error: "Ongeldige parameters" }, { status: 400 });
    }

    const session = await getSession(sessionId, {
      limit: result.data.limit,
      cursor: result.data.cursor ?? null,
    });

    if (!session) {
      return Response.json({ error: "Sessie niet gevonden" }, { status: 404 });
    }

    return Response.json(session);
  },
  { logPrefix: "chat-sessies/[sessionId] GET", rateLimit: { interval: 60_000, limit: 30 } },
);

export const DELETE = withApiHandler(
  async (_req: Request, { params }: RouteParams) => {
    const { sessionId } = await params;
    const deleted = await deleteSession(sessionId);
    if (!deleted) {
      return Response.json({ error: "Sessie niet gevonden" }, { status: 404 });
    }
    return Response.json({ success: true });
  },
  { logPrefix: "chat-sessies/[sessionId] DELETE", rateLimit: { interval: 60_000, limit: 10 } },
);
