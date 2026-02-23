/**
 * Enrich existing Striive jobs with detail-page content.
 *
 * Fetches each job's detail from the Striive supplier API and updates
 * the database with full description, requirements, wishes, competences,
 * conditions, and rate information.
 *
 * Usage:
 *   STRIIVE_SESSION_COOKIE="your-cookie" npx tsx scripts/enrich-striive-details.ts
 *
 * To get the cookie:
 *   1. Log into https://supplier.striive.com in your browser
 *   2. DevTools → Network → any API request → copy Cookie header value
 *   3. Set as STRIIVE_SESSION_COOKIE env var
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../src/db";
import { jobs } from "../src/db/schema";

const API_BASE = "https://supplier.striive.com/api/v2/job-requests";
const DELAY_MS = 500; // Polite delay between requests

interface StriiveDetail {
  id: number;
  title: string;
  description?: string;
  maxRate?: number;
  maxRateExclVAT?: number;
  remoteAllowed?: string;
  subcontractingAllowed?: boolean;
  requirements?: Array<{
    description: string;
    isKnockout?: boolean;
    type?: string;
  }>;
  wishes?: Array<{
    description: string;
    evaluationCriteria?: string;
  }>;
  competencies?: Array<{ name: string }>;
  competences?: string[];
  conditions?: string[];
  qualificationRequirements?: any[];
  selectionCriteria?: any[];
}

function mapWorkArrangement(remote?: string): "remote" | "hybride" | "op_locatie" | undefined {
  if (!remote) return undefined;
  switch (remote) {
    case "HYBRID":
      return "hybride";
    case "NO":
      return "op_locatie";
    case "YES":
      return "remote";
    default:
      return undefined;
  }
}

/**
 * Get session cookie from env var.
 */
async function getSessionCookie(): Promise<string> {
  if (process.env.STRIIVE_SESSION_COOKIE) {
    console.log("Using STRIIVE_SESSION_COOKIE from environment\n");
    return process.env.STRIIVE_SESSION_COOKIE;
  }

  console.error(
    "STRIIVE_SESSION_COOKIE is required.\n\n" +
      "To get the cookie:\n" +
      "  1. Log into https://supplier.striive.com in your browser\n" +
      "  2. DevTools → Network → any API request → copy Cookie header value\n" +
      "  3. STRIIVE_SESSION_COOKIE='...' npx tsx scripts/enrich-striive-details.ts",
  );
  process.exit(1);
}

async function fetchJobDetail(jobId: string, cookie: string): Promise<StriiveDetail | null> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(jobId)}`, {
    headers: {
      Cookie: cookie,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Session expired — log in again or refresh cookie");
    }
    return null;
  }

  return res.json();
}

function extractRequirements(
  detail: StriiveDetail,
): Array<{ description: string; isKnockout: boolean }> {
  const reqs: Array<{ description: string; isKnockout: boolean }> = [];

  if (detail.requirements?.length) {
    for (const r of detail.requirements) {
      reqs.push({
        description: r.description,
        isKnockout: r.isKnockout ?? r.type === "KNOCKOUT",
      });
    }
  }

  if (detail.qualificationRequirements?.length) {
    for (const r of detail.qualificationRequirements) {
      const desc = typeof r === "string" ? r : (r.description ?? r.name ?? String(r));
      reqs.push({ description: desc, isKnockout: true });
    }
  }

  return reqs;
}

function extractWishes(
  detail: StriiveDetail,
): Array<{ description: string; evaluationCriteria?: string }> {
  const wishes: Array<{ description: string; evaluationCriteria?: string }> = [];

  if (detail.wishes?.length) {
    for (const w of detail.wishes) {
      wishes.push({
        description: w.description,
        evaluationCriteria: w.evaluationCriteria,
      });
    }
  }

  if (detail.selectionCriteria?.length) {
    for (const s of detail.selectionCriteria) {
      const desc = typeof s === "string" ? s : (s.description ?? s.name ?? String(s));
      wishes.push({ description: desc });
    }
  }

  return wishes;
}

function extractCompetences(detail: StriiveDetail): string[] {
  if (detail.competences?.length) return detail.competences;
  if (detail.competencies?.length) {
    return detail.competencies.map((c) => c.name ?? String(c));
  }
  return [];
}

async function main() {
  const cookie = await getSessionCookie();

  // Verify cookie works with a quick test
  console.log("Verifying API access...");
  const testRes = await fetch(`${API_BASE}?page=0&size=1`, {
    headers: { Cookie: cookie, Accept: "application/json" },
  });
  if (!testRes.ok) {
    console.error(`API returned ${testRes.status}. Cookie may be expired — log in again.`);
    process.exit(1);
  }
  console.log("API access verified.\n");

  // Get all Striive jobs that have sparse content
  const sparseJobs = await db
    .select({
      id: jobs.id,
      externalId: jobs.externalId,
      description: jobs.description,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.platform, "striive"),
        isNull(jobs.deletedAt),
        sql`length(${jobs.description}) < 200 OR ${jobs.description} IS NULL`,
      ),
    );

  console.log(`Found ${sparseJobs.length} Striive jobs needing enrichment\n`);

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of sparseJobs) {
    try {
      const detail = await fetchJobDetail(job.externalId, cookie);

      if (!detail) {
        console.log(`  SKIP ${job.externalId}: not found in API`);
        skipped++;
        continue;
      }

      const requirements = extractRequirements(detail);
      const wishes = extractWishes(detail);
      const competences = extractCompetences(detail);
      const conditions = detail.conditions ?? [];
      const description =
        detail.description && detail.description.length > (job.description?.length ?? 0)
          ? detail.description
          : job.description;
      const rateMax = detail.maxRateExclVAT ?? detail.maxRate;
      const workArrangement = mapWorkArrangement(detail.remoteAllowed);

      await db
        .update(jobs)
        .set({
          description,
          rateMax: rateMax ?? undefined,
          workArrangement: workArrangement ?? undefined,
          allowsSubcontracting: detail.subcontractingAllowed,
          requirements,
          wishes,
          competences,
          conditions,
        })
        .where(eq(jobs.id, job.id));

      console.log(
        `  OK   ${job.externalId}: desc=${description?.length ?? 0}ch, ` +
          `${requirements.length} eisen, ${wishes.length} wensen, ` +
          `${competences.length} comp, rate=${rateMax ?? "-"}`,
      );
      enriched++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Session expired")) {
        console.error(`\nFATAL: ${msg}`);
        process.exit(1);
      }
      console.log(`  FAIL ${job.externalId}: ${msg}`);
      failed++;
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`\nDone: ${enriched} enriched, ${skipped} skipped, ${failed} failed`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Enrichment failed:", err);
  process.exit(1);
});
