import { deleteMessage } from "@/src/services/messages";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = await deleteMessage(id);
    if (!deleted) {
      return Response.json({ error: "Bericht niet gevonden" }, { status: 404 });
    }
    return Response.json({ data: { id } });
  } catch {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
