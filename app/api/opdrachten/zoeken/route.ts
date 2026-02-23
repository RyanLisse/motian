import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { jobs } from "@/src/db/schema";
import { escapeLike } from "@/src/lib/helpers";

export const dynamic = "force-dynamic";

const PER_PAGE = 10;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const platform = params.get("platform") ?? "";
  const provincie = params.get("provincie") ?? "";
  const page = Math.max(1, parseInt(params.get("pagina") ?? "1", 10));
  const offset = (page - 1) * PER_PAGE;

  const conditions = [isNull(jobs.deletedAt)];

  // Multi-field search with ILIKE across title, company, description, location
  if (q.length >= 2) {
    const pattern = `%${escapeLike(q)}%`;
    conditions.push(
      or(
        ilike(jobs.title, pattern),
        ilike(jobs.company, pattern),
        ilike(jobs.description, pattern),
        ilike(jobs.location, pattern),
        ilike(jobs.platform, pattern),
      )!,
    );
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
      .limit(PER_PAGE)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(whereClause),
  ]);

  const total = countResult[0]?.count ?? 0;

  return NextResponse.json({
    jobs: rows,
    total,
    page,
    totalPages: Math.ceil(total / PER_PAGE),
  });
}
