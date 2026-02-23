import type { NextRequest } from "next/server";
import { updateConfig } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (typeof body.cronExpression === "string") data.cronExpression = body.cronExpression;
    if (body.parameters && typeof body.parameters === "object") data.parameters = body.parameters;

    const config = await updateConfig(id, data);
    if (!config) {
      return Response.json({ error: "Scraper configuratie niet gevonden" }, { status: 404 });
    }

    return Response.json({ data: config });
  } catch (error) {
    console.error("Fout bij bijwerken scraper configuratie:", error);
    return Response.json({ error: "Kan scraper configuratie niet bijwerken" }, { status: 500 });
  }
}
