import type { NextRequest } from "next/server";
import { getAllConfigs } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const configs = await getAllConfigs();
    return Response.json({ data: configs, total: configs.length });
  } catch (error) {
    console.error("Fout bij ophalen scraper configuraties:", error);
    return Response.json({ error: "Kan scraper configuraties niet ophalen" }, { status: 500 });
  }
}
