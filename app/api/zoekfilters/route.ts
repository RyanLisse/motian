import type { NextRequest } from "next/server";
import { withApiHandler } from "@/src/lib/api-handler";
import { createSavedSearchSchema } from "@/src/schemas/saved-searches";
import { createSavedSearch, listSavedSearches } from "@/src/services/saved-searches";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (_request: NextRequest) => {
    const data = await listSavedSearches();
    return Response.json(
      { data },
      {
        headers: { "Cache-Control": "private, max-age=15" },
      },
    );
  },
  {
    logPrefix: "Fout bij ophalen zoekfilters",
    errorMessage: "Kan zoekfilters niet ophalen",
  },
);

export const POST = withApiHandler(
  async (request: NextRequest) => {
    const body = await request.json();
    const parsed = createSavedSearchSchema.parse(body);
    const created = await createSavedSearch(parsed.name, parsed.filters);
    return Response.json(
      { data: created },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  {
    logPrefix: "Fout bij aanmaken zoekfilter",
    errorMessage: "Kan zoekfilter niet aanmaken",
    rateLimit: { interval: 60_000, limit: 30 },
  },
);
