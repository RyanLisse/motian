import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { jobs } from "@/src/db/schema";
import { escapeLike } from "@/src/lib/helpers";
import { parsePagination } from "@/src/lib/pagination";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const platform = params.get("platform") ?? "";
  const provincie = params.get("provincie") ?? "";
  const { page, limit, offset } = parsePagination(params, { limit: 10 });

  const conditions = [isNull(jobs.deletedAt)];

  // Multi-field search with ILIKE across title, company, description, location
  if (q.length >= 2) {
    const pattern = `%${escapeLike(q)}%`;
    const searchCondition = or(
      ilike(jobs.title, pattern),
      ilike(jobs.company, pattern),
      ilike(jobs.description, pattern),
      ilike(jobs.location, pattern),
      ilike(jobs.platform, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  if (platform) {
    conditions.push(eq(jobs.platform, platform));
  }

  if (provincie) {
    conditions.push(ilike(jobs.location, `%${escapeLike(provincie)}%`));
  }

  const whereClause = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        location: jobs.location,
        platform: jobs.platform,
        workArrangement: jobs.workArrangement,
        contractType: jobs.contractType,
      })
      .from(jobs)
      .where(whereClause)
      .orderBy(desc(jobs.scrapedAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(whereClause),
  ]);

  const total = countResult[0]?.count ?? 0;

  return NextResponse.json({
    jobs: rows,
    total,
    page,
    perPage: limit,
    totalPages: Math.ceil(total / limit),
  });
}
