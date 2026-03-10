import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { publish } from "@/src/lib/event-bus";
import { rateLimit } from "@/src/lib/rate-limit";
import { importJobsFromActiveScrapers } from "@/src/services/operations-console";

const limiter = rateLimit({ interval: 300_000, limit: 5 });

export const dynamic = "force-dynamic";

const triggerSchema = z.object({
  platform: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "anonymous";
  const { success, reset } = limiter.check(ip);
  if (!success) {
    return Response.json(
      { error: "Te veel verzoeken. Probeer het later opnieuw." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = triggerSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Ongeldige invoer" }, { status: 400 });
    }

    const summary = await importJobsFromActiveScrapers(parsed.data.platform);

    if (summary.totalPlatforms === 0) {
      return Response.json(
        { error: "Geen actieve scraper configuratie gevonden" },
        { status: 404 },
      );
    }

    revalidatePath("/opdrachten");
    revalidatePath("/scraper");
    revalidatePath("/overzicht");
    publish("scrape:completed", { platforms: summary.platforms.map((s) => s.platform) });

    return Response.json({
      message: `Scrape gestart voor ${summary.totalPlatforms} platform(en)`,
      platforms: summary.platforms,
    });
  } catch (_err) {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
