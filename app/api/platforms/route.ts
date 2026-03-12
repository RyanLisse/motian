import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { createPlatformCatalogEntry, listPlatformCatalog } from "@/src/services/scrapers";

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
  async () => {
    const data = await listPlatformCatalog();
    return Response.json({ data, total: data.length });
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
    return Response.json({ data }, { status: 201 });
  },
  {
    logPrefix: "Fout bij aanmaken platform catalogus entry",
    errorMessage: "Kan platform catalogus entry niet opslaan",
  },
);
