import { and, isNull, lt } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/src/db";
import { jobs } from "@/src/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    const expired = await db
      .update(jobs)
      .set({ deletedAt: now })
      .where(and(lt(jobs.applicationDeadline, now), isNull(jobs.deletedAt)))
      .returning({ id: jobs.id });

    return Response.json({
      message: `${expired.length} verlopen vacatures verwijderd`,
      count: expired.length,
    });
  } catch (_err) {
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
