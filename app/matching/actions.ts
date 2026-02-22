"use server";

import { db } from "@/src/db";
import { jobMatches } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateMatchStatus(matchId: string, status: "approved" | "rejected") {
  await db
    .update(jobMatches)
    .set({
      status,
      reviewedAt: new Date(),
      reviewedBy: "system",
    })
    .where(eq(jobMatches.id, matchId));

  revalidatePath("/matching");
}
