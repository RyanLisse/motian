import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { applications, candidates, interviews, jobMatches, messages } from "../db/schema";

// ========== Types ==========

export type CandidateExport = {
  candidate: typeof candidates.$inferSelect;
  applications: (typeof applications.$inferSelect)[];
  interviews: (typeof interviews.$inferSelect)[];
  messages: (typeof messages.$inferSelect)[];
  matches: (typeof jobMatches.$inferSelect)[];
};

export type ErasureResult = {
  deletedMessages: number;
  deletedInterviews: number;
  deletedApplications: number;
  deletedMatches: number;
  deletedCandidate: boolean;
};

// ========== GDPR Art. 15 — Recht op inzage ==========

/** Exporteer alle data voor een kandidaat (GDPR Art. 15 — Right of Access). */
export async function exportCandidateData(candidateId: string): Promise<CandidateExport | null> {
  // Kandidaat ophalen (GDPR-verzoek geldt altijd, maar exporteer geen soft-deleted data tenzij specifiek gevraagd)
  const candidateRows = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.id, candidateId), isNull(candidates.deletedAt)))
    .limit(1);

  const candidate = candidateRows[0];
  if (!candidate) return null;

  // Sollicitaties ophalen
  const applicationRows = await db
    .select()
    .from(applications)
    .where(eq(applications.candidateId, candidateId));

  const applicationIds = applicationRows.map((a) => a.id);

  // Interviews ophalen via sollicitatie-IDs
  const interviewRows =
    applicationIds.length > 0
      ? await db.select().from(interviews).where(inArray(interviews.applicationId, applicationIds))
      : [];

  // Berichten ophalen via sollicitatie-IDs
  const messageRows =
    applicationIds.length > 0
      ? await db.select().from(messages).where(inArray(messages.applicationId, applicationIds))
      : [];

  // Matches ophalen
  const matchRows = await db
    .select()
    .from(jobMatches)
    .where(eq(jobMatches.candidateId, candidateId));

  return {
    candidate,
    applications: applicationRows,
    interviews: interviewRows,
    messages: messageRows,
    matches: matchRows,
  };
}

// ========== GDPR Art. 17 — Recht op vergetelheid ==========

/** Hard-delete alle kandidaatdata (GDPR Art. 17 — Right to Erasure). */
export async function eraseCandidateData(candidateId: string): Promise<ErasureResult> {
  return await db.transaction(async (tx) => {
    // Eerst sollicitatie-IDs ophalen (nodig voor cascading deletes)
    const applicationRows = await tx
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.candidateId, candidateId));

    const applicationIds = applicationRows.map((a) => a.id);

    // 1. Berichten verwijderen (via sollicitatie-IDs)
    let deletedMessages = 0;
    if (applicationIds.length > 0) {
      const msgResult = await tx
        .delete(messages)
        .where(inArray(messages.applicationId, applicationIds))
        .returning({ id: messages.id });
      deletedMessages = msgResult.length;
    }

    // 2. Interviews verwijderen (via sollicitatie-IDs)
    let deletedInterviews = 0;
    if (applicationIds.length > 0) {
      const intResult = await tx
        .delete(interviews)
        .where(inArray(interviews.applicationId, applicationIds))
        .returning({ id: interviews.id });
      deletedInterviews = intResult.length;
    }

    // 3. Sollicitaties verwijderen
    const appResult = await tx
      .delete(applications)
      .where(eq(applications.candidateId, candidateId))
      .returning({ id: applications.id });
    const deletedApplications = appResult.length;

    // 4. Matches verwijderen
    const matchResult = await tx
      .delete(jobMatches)
      .where(eq(jobMatches.candidateId, candidateId))
      .returning({ id: jobMatches.id });
    const deletedMatches = matchResult.length;

    // 5. Kandidaat hard-deleten (NIET soft-delete)
    const candidateResult = await tx
      .delete(candidates)
      .where(eq(candidates.id, candidateId))
      .returning({ id: candidates.id });
    const deletedCandidate = candidateResult.length > 0;

    return {
      deletedMessages,
      deletedInterviews,
      deletedApplications,
      deletedMatches,
      deletedCandidate,
    };
  });
}

// ========== Data Retention Helpers ==========

/** Kandidaten ophalen waarvan de dataretentie is verlopen. */
export async function findExpiredRetentionCandidates(): Promise<
  { id: string; name: string; dataRetentionUntil: Date }[]
> {
  const rows = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      dataRetentionUntil: candidates.dataRetentionUntil,
    })
    .from(candidates)
    .where(
      and(isNotNull(candidates.dataRetentionUntil), sql`${candidates.dataRetentionUntil} < NOW()`),
    );

  // isNotNull filter guarantees dataRetentionUntil is non-null
  return rows as { id: string; name: string; dataRetentionUntil: Date }[];
}
