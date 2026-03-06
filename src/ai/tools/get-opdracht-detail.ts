import { tool } from "ai";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/src/db";
import { applications } from "@/src/db/schema";
import { withJobCanonicalSkills } from "@/src/services/esco";
import { getJobById } from "@/src/services/jobs";

export const getOpdrachtDetail = tool({
  description:
    "Haal volledige details op van één opdracht op basis van ID. Gebruik dit wanneer de gebruiker meer wil weten over een specifieke opdracht.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de opdracht"),
  }),
  execute: async ({ id }) => {
    const job = await getJobById(id);
    if (!job) return { error: "Opdracht niet gevonden" };

    // Fetch canonical skills and active pipeline count in parallel
    const [jobWithCanonicalSkills, pipelineResult] = await Promise.all([
      withJobCanonicalSkills(job),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(applications)
        .where(
          and(
            eq(applications.jobId, id),
            isNull(applications.deletedAt),
            ne(applications.stage, "rejected"),
          ),
        ),
    ]);

    // Return rich detail, excluding rawPayload and embedding (too large)
    const { rawPayload, embedding, ...detail } = jobWithCanonicalSkills;
    return {
      ...detail,
      pipelineCount: pipelineResult[0]?.count ?? 0,
    };
  },
});
