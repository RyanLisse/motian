import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { analyzePlatform } from "@/src/services/platform-analyzer";
import { createPlatformCatalogEntry, runPlatformOnboardingWorkflow } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  url: z.string().url("Een geldige platform URL is verplicht"),
  activate: z.boolean().optional().default(true),
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

    const { url, activate } = parsed.data;

    // Step 1: AI analysis
    const analysis = await analyzePlatform(url);

    // Step 2: Create catalog entry
    await createPlatformCatalogEntry({
      slug: analysis.slug,
      displayName: analysis.displayName,
      adapterKind: analysis.adapterKind,
      authMode: analysis.authMode,
      attributionLabel: analysis.displayName,
      description: analysis.description,
      defaultBaseUrl: analysis.defaultBaseUrl,
      capabilities: analysis.capabilities,
      source: "ui",
    });

    // Step 3: Full onboarding workflow
    const result = await runPlatformOnboardingWorkflow({
      source: "ui",
      config: {
        platform: analysis.slug,
        baseUrl: analysis.defaultBaseUrl,
        parameters: {
          scrapingStrategy: analysis.scrapingStrategy,
          maxPages: analysis.scrapingStrategy.maxPages,
        },
        source: "ui",
      },
      activate,
    });

    return Response.json({
      data: {
        platform: analysis.slug,
        displayName: analysis.displayName,
        adapterKind: analysis.adapterKind,
        validation: {
          ok: result.validation.ok,
          message: result.validation.message,
        },
        testImport: {
          status: result.testImport.status,
          jobsFound: result.testImport.jobsFound,
        },
        activated: result.activated,
      },
    });
  },
  {
    logPrefix: "Fout bij automatische platform setup",
    errorMessage: "Kan platform niet automatisch inrichten",
    rateLimit: { interval: 60_000, limit: 3 },
  },
);
