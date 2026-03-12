import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { activatePlatform } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const data = await activatePlatform(slug, "ui");
    return Response.json({ data });
  },
  {
    logPrefix: "Fout bij activeren platform",
    errorMessage: "Kan platform niet activeren",
  },
);
