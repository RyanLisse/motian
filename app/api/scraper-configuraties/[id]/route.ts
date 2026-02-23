import type { NextRequest } from "next/server";
import { z } from "zod";
import { updateConfig } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    isActive: z.boolean().optional(),
    cronExpression: z.string().max(100).optional(),
    parameters: z.record(z.unknown()).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Minimaal één veld vereist",
  });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    return Response.json({ data: config });
  } catch (error) {
    console.error("Fout bij bijwerken scraper configuratie:", error);
    return Response.json({ error: "Kan scraper configuratie niet bijwerken" }, { status: 500 });
  }
}
