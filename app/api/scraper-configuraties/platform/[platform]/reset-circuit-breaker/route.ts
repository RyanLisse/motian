import { db, eq } from "@/src/db";
import { scraperConfigs } from "@/src/db/schema";
import { withApiHandler } from "@/src/lib/api-handler";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async (request: Request, { params }: { params: Promise<{ platform: string }> }) => {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { platform } = await params;

    const [config] = await db
      .select()
      .from(scraperConfigs)
      .where(eq(scraperConfigs.platform, platform))
      .limit(1);

    if (!config) {
      return Response.json({ error: `Platform "${platform}" niet gevonden` }, { status: 404 });
    }

    if ((config.consecutiveFailures ?? 0) === 0) {
      return Response.json(
        {
          platform,
          previousFailures: 0,
          message: `Circuit breaker voor ${platform} staat al open (geen fouten)`,
        },
        {
          headers: { "Cache-Control": "private, no-cache, no-store" },
        },
      );
    }

    await db
      .update(scraperConfigs)
      .set({ consecutiveFailures: 0, lastRunStatus: null })
      .where(eq(scraperConfigs.id, config.id));

    return Response.json(
      {
        platform,
        previousFailures: config.consecutiveFailures,
        message: `Circuit breaker voor ${platform} gereset`,
      },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  },
  {
    logPrefix: "Fout bij resetten circuit breaker",
    errorMessage: "Kan circuit breaker niet resetten",
  },
);
