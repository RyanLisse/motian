import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { listSessions } from "@/src/services/chat-sessions";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withApiHandler(
  async (req: Request) => {
    const url = new URL(req.url);
    const result = querySchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!result.success) {
      return Response.json({ error: "Ongeldige parameters" }, { status: 400 });
    }
    const params = result.data;

    const sessions = await listSessions(params.limit);
    return Response.json({ sessions, total: sessions.length });
  },
  { logPrefix: "chat-sessies" },
);
