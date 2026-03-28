import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { jsonObjectSchema } from "@/src/lib/json-value-schema";
import { createConfig, getAllConfigs } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  platform: z.string().min(1),
  baseUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  cronExpression: z.string().optional(),
  credentialsRef: z.string().optional(),
  parameters: jsonObjectSchema.optional(),
  authConfig: jsonObjectSchema.optional(),
});

export const GET = withApiHandler(
  async (_request: NextRequest) => {
    const configs = await getAllConfigs();
    return Response.json(
      { data: configs, total: configs.length },
      {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      },
    );
  },
  {
    logPrefix: "Fout bij ophalen scraper configuraties",
    errorMessage: "Kan scraper configuraties niet ophalen",
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

    const config = await createConfig({ ...parsed.data, source: "ui" });
    return Response.json(
      { data: config },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  {
    logPrefix: "Fout bij aanmaken scraper configuratie",
    errorMessage: "Kan scraper configuratie niet opslaan",
  },
);
