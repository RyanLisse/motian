import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tags: string[] = body.tags ?? ["jobs", "scrapers", "scrape-results"];

    for (const tag of tags) {
      revalidateTag(tag, "default");
    }

    return NextResponse.json({
      revalidated: true,
      tags,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ revalidated: false, error: "Ongeldige aanvraag" }, { status: 400 });
  }
}
