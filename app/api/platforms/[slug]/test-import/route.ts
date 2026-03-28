import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { triggerTestRun } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const body = await request.json().catch(() => ({}));
    const limit = typeof body?.limit === "number" ? body.limit : 3;
    const data = await triggerTestRun(slug, "ui", limit);
    return Response.json(
      { data },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  {
    logPrefix: "Fout bij platform smoke import",
    errorMessage: "Kan platform smoke import niet uitvoeren",
  },
);
