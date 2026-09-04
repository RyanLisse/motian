import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePrincipal } from "@/src/lib/api-auth";

const revalidateSchema = z.object({
  tags: z
    .array(z.string().max(50))
    .max(20)
    .optional()
    .default(["jobs", "scrapers", "scrape-results"]),
});

export async function POST(request: NextRequest) {
  const principalOrResponse = await requirePrincipal(request);
  if (principalOrResponse instanceof Response) {
    return principalOrResponse;
  }

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

    return NextResponse.json(
      {
        revalidated: true,
        tags,
        timestamp: new Date().toISOString(),
      },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  } catch {
    return NextResponse.json({ revalidated: false, error: "Ongeldige aanvraag" }, { status: 400 });
  }
}
