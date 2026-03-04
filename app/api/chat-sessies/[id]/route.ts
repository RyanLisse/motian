import { withApiHandler } from "@/src/lib/api-handler";
import { deleteSession, getSession } from "@/src/services/chat-sessions";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = withApiHandler(
  async (_req: Request, { params }: RouteParams) => {
    const { id } = await params;
    const session = await getSession(id);
    if (!session) {
      return Response.json({ error: "Sessie niet gevonden" }, { status: 404 });
    }
    return Response.json(session);
  },
  { logPrefix: "chat-sessies/[id] GET" },
);

export const DELETE = withApiHandler(
  async (_req: Request, { params }: RouteParams) => {
    const { id } = await params;
    const deleted = await deleteSession(id);
    if (!deleted) {
      return Response.json({ error: "Sessie niet gevonden" }, { status: 404 });
    }
    return Response.json({ success: true });
  },
  { logPrefix: "chat-sessies/[id] DELETE" },
);
