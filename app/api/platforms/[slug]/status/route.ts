import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { getPlatformOnboardingStatus } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const data = await getPlatformOnboardingStatus(slug);
    return Response.json(
      { data },
      {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
      },
    );
  },
  {
    logPrefix: "Fout bij ophalen platform status",
    errorMessage: "Kan platform status niet ophalen",
  },
);
