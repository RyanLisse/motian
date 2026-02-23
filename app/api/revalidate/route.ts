import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const revalidateSchema = z.object({
  tags: z
    .array(z.string().max(50))
    .max(20)
    .optional()
    .default(["jobs", "scrapers", "scrape-results"]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = revalidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { revalidated: false, error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { tags } = parsed.data;

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
