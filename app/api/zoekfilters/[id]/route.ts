import { withApiHandler } from "@/src/lib/api-handler";
import { deleteSavedSearch } from "@/src/services/saved-searches";

export const dynamic = "force-dynamic";

export const DELETE = withApiHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const deleted = await deleteSavedSearch(id);
    if (!deleted) {
      return Response.json({ error: "Zoekfilter niet gevonden" }, { status: 404 });
    }
    return Response.json(
      { data: { id } },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  { logPrefix: "DELETE /api/zoekfilters/[id] error" },
);
