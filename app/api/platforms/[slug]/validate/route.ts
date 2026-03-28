import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { validateConfig } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const data = await validateConfig(slug, "ui");
    return Response.json(
      { data },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  {
    logPrefix: "Fout bij valideren platform configuratie",
    errorMessage: "Kan platform configuratie niet valideren",
  },
);
