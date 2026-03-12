import * as Sentry from "@sentry/nextjs";
import type { NextRequest } from "next/server";
import { activatePlatform } from "@/src/services/scrapers";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const data = await activatePlatform(slug, "ui");
    return Response.json({ data });
  } catch (error) {
    console.error("Fout bij activeren platform:", error);
    Sentry.captureException(error, { tags: { source: "platform-activate-route" } });

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Kan platform niet activeren",
      },
      { status: 400 },
    );
  }
}
