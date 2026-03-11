import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { listSessions } from "@/src/services/chat-sessions";

const querySchema = z.object({
  limit: z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }, z.coerce.number().int().min(1).max(50).default(20)),
  cursor: z.string().min(1).optional(),
});

export const GET = withApiHandler(
  async (req: Request) => {
    const url = new URL(req.url);
    const result = querySchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    if (!result.success) {
      return Response.json({ error: "Ongeldige parameters" }, { status: 400 });
    }
    const params = result.data;

    const page = await listSessions({ limit: params.limit, cursor: params.cursor ?? null });
    return Response.json(page);
  },
  { logPrefix: "chat-sessies", rateLimit: { interval: 60_000, limit: 30 } },
);
