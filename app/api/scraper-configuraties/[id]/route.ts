import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { jsonObjectSchema } from "@/src/lib/json-value-schema";
import { updateConfig } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    authConfig: jsonObjectSchema.optional(),
    baseUrl: z.string().url().optional(),
    isActive: z.boolean().optional(),
    cronExpression: z.string().max(100).optional(),
    credentialsRef: z.string().optional(),
    parameters: jsonObjectSchema.optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Minimaal één veld vereist",
  });

export const PATCH = withApiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = await request.json();

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const config = await updateConfig(id, parsed.data);
    if (!config) {
      return Response.json({ error: "Scraper configuratie niet gevonden" }, { status: 404 });
    }

    return Response.json(
      { data: config },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  {
    logPrefix: "Fout bij bijwerken scraper configuratie",
    errorMessage: "Kan scraper configuratie niet bijwerken",
  },
);
