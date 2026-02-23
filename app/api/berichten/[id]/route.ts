import { withApiHandler } from "@/src/lib/api-handler";
import { deleteMessage } from "@/src/services/messages";

export const dynamic = "force-dynamic";

export const DELETE = withApiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const deleted = await deleteMessage(id);
    if (!deleted) {
      return Response.json({ error: "Bericht niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: { id } });
  },
  { logPrefix: "DELETE /api/berichten/[id] error" },
);
