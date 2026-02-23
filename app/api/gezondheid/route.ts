import type { NextRequest } from "next/server";
import { getHealth } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const health = await getHealth();
    return Response.json(health);
  } catch (error) {
    console.error("Fout bij ophalen gezondheidsstatus:", error);
    return Response.json({ error: "Kan gezondheidsstatus niet ophalen" }, { status: 500 });
  }
}
