import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { analyzePlatform } from "@/src/services/platform-analyzer";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  url: z.string().url("Een geldige URL is verplicht"),
});

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

    const analysis = await analyzePlatform(parsed.data.url);
    return Response.json(
      { data: analysis },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  {
    logPrefix: "Fout bij platform analyse",
    errorMessage: "Kan platform niet analyseren",
    rateLimit: { interval: 60_000, limit: 5 },
  },
);
