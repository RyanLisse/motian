import { z } from "zod";
import { type FeedJob, toJobRss, toJobXml } from "@/src/lib/feed-formatters";
import { listJobs } from "@/src/services/jobs";

export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

const querySchema = z.object({
  format: z.enum(["xml", "json", "rss"]).default("xml"),
  platform: z.string().optional(),
  status: z.string().default("open"),
  location: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return Response.json(
      { error: "Ongeldige parameters", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { format, platform, status, location, limit } = parsed.data;

  const { data: jobs } = await listJobs({
    status: status as "open" | "closed" | "all",
    platform,
    province: location,
    limit,
  });

  const feedJobs: FeedJob[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    description: j.description,
    platform: j.platform,
    postedAt: j.postedAt,
    externalUrl: j.externalUrl,
  }));

  const headers = new Headers({ "Cache-Control": CACHE_CONTROL });

  switch (format) {
    case "json":
      headers.set("Content-Type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(feedJobs), { headers });

    case "rss":
      headers.set("Content-Type", "application/rss+xml; charset=utf-8");
      return new Response(toJobRss(feedJobs), { headers });

    default:
      headers.set("Content-Type", "application/xml; charset=utf-8");
      return new Response(toJobXml(feedJobs), { headers });
  }
}
