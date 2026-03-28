import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { settingsPayloadSchema } from "@/src/schemas/settings";
import { getAllSettings, updateSettings } from "@/src/services/settings";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_request: NextRequest) => {
    const settings = await getAllSettings();
    return Response.json(
      { data: settings },
      {
        headers: { "Cache-Control": "private, s-maxage=15, stale-while-revalidate=30" },
      },
    );
  },
  {
    logPrefix: "Fout bij ophalen instellingen",
    errorMessage: "Kan instellingen niet ophalen",
  },
);

export const PUT = withApiHandler(
  async (request: NextRequest) => {
    const body = await request.json();
    const parsed = settingsPayloadSchema.partial().parse(body);
    const updated = await updateSettings(parsed);
    return Response.json(
      { data: updated },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  {
    logPrefix: "Fout bij bijwerken instellingen",
    errorMessage: "Kan instellingen niet bijwerken",
    rateLimit: { interval: 60_000, limit: 30 },
  },
);
