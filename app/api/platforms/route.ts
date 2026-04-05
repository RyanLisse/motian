import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { paginatedResponse, parsePagination } from "@/src/lib/pagination";
import { createPlatformCatalogEntry, listPlatformCatalogPage } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  slug: z.string().min(1),
  displayName: z.string().optional(),
  adapterKind: z.string().optional(),
  authMode: z.string().optional(),
  attributionLabel: z.string().optional(),
  description: z.string().optional(),
  defaultBaseUrl: z.string().url().optional(),
  docsUrl: z.string().url().optional(),
});

export const GET = withApiHandler(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = parsePagination(searchParams);
    const { data, total } = await listPlatformCatalogPage({ limit, offset });
    return Response.json(paginatedResponse(data, total, { page, limit, offset }), {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  },
  {
    logPrefix: "Fout bij ophalen platforms",
    errorMessage: "Kan platform catalogus niet ophalen",
  },
);

export const POST = withApiHandler(
  async (request: NextRequest) => {
    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = await createPlatformCatalogEntry({ ...parsed.data, source: "ui" });
    return Response.json(
      { data },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  {
    logPrefix: "Fout bij aanmaken platform catalogus entry",
    errorMessage: "Kan platform catalogus entry niet opslaan",
  },
);
