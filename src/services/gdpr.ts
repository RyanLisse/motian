import { and, db, eq, inArray, isNotNull, isNull, or, sql } from "../db";
import {
  applications,
  candidates,
  gdprAuditLog,
  interviews,
  jobMatches,
  jobs,
  messages,
} from "../db/schema";
import { escapeLike } from "../lib/helpers";

// ========== Types ==========

export type CandidateExport = {
  candidate: typeof candidates.$inferSelect;
  applications: (typeof applications.$inferSelect)[];
  interviews: (typeof interviews.$inferSelect)[];
  messages: (typeof messages.$inferSelect)[];
  matches: (typeof jobMatches.$inferSelect)[];
  relatedContacts: {
    jobId: string;
    jobTitle: string;
    agentContact: unknown;
    recruiterContact: unknown;
  }[];
};

export type ErasureResult = {
  deletedMessages: number;
  deletedInterviews: number;
  deletedApplications: number;
  deletedMatches: number;
  deletedCandidate: boolean;
};

// ========== Audit Trail ==========

/** Log a GDPR action to the audit trail (immutable record). */
async function logGdprAction(
  action: string,
  subjectType: string,
  subjectRef: string,
  actor: string,
  details: Record<string, unknown> = {},
  reason?: string,
) {
  try {
    await db.insert(gdprAuditLog).values({
      action,
      subjectType,
      subjectId: subjectRef,
      requestedBy: actor,
      reason: reason ?? null,
      details,
    });
  } catch (error) {
    // Audit trail should not block primary GDPR operations.
    console.error("[GDPR] Audit log write failed:", error);
  }
}

// ========== GDPR Art. 15 — Recht op inzage ==========

/** Exporteer alle data voor een kandidaat (GDPR Art. 15 — Right of Access). */
export async function exportCandidateData(
  candidateId: string,
  requestedBy: string = "system",
): Promise<CandidateExport | null> {
  const candidateRows = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.id, candidateId), isNull(candidates.deletedAt)))
    .limit(1);

  const candidate = candidateRows[0];
  if (!candidate) return null;

  const [applicationRows, matchRows] = await Promise.all([
    db.select().from(applications).where(eq(applications.candidateId, candidateId)),
    db.select().from(jobMatches).where(eq(jobMatches.candidateId, candidateId)),
  ]);

  const applicationIds = applicationRows.map((a) => a.id);
  const jobIds = [
    ...new Set(applicationRows.map((a) => a.jobId).filter((id): id is string => !!id)),
  ];

  const [interviewRows, messageRows, relatedContacts] = await Promise.all([
    applicationIds.length > 0
      ? db
          .select()
          .from(interviews)
          .where(
            and(inArray(interviews.applicationId, applicationIds), isNull(interviews.deletedAt)),
          )
      : Promise.resolve([]),
    applicationIds.length > 0
      ? db
          .select()
          .from(messages)
          .where(and(inArray(messages.applicationId, applicationIds), isNull(messages.deletedAt)))
      : Promise.resolve([]),
    jobIds.length > 0
      ? db
          .select({
            jobId: jobs.id,
            jobTitle: jobs.title,
            agentContact: jobs.agentContact,
            recruiterContact: jobs.recruiterContact,
          })
          .from(jobs)
          .where(inArray(jobs.id, jobIds))
      : Promise.resolve([]),
  ]);

  // Audit trail
  await logGdprAction("export_candidate", "candidate", candidateId, requestedBy, {
    applications: applicationRows.length,
    interviews: interviewRows.length,
    messages: messageRows.length,
    matches: matchRows.length,
    relatedContacts: relatedContacts.length,
  });

  return {
    candidate,
    applications: applicationRows,
    interviews: interviewRows,
    messages: messageRows,
    matches: matchRows,
    relatedContacts,
  };
}

// ========== GDPR Art. 17 — Recht op vergetelheid ==========

/** Hard-delete alle kandidaatdata (GDPR Art. 17 — Right to Erasure). */
export async function eraseCandidateData(
  candidateId: string,
  requestedBy: string = "system",
): Promise<ErasureResult> {
  const result = await db.transaction(async (tx) => {
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

  // Audit trail (outside transaction — erasure already committed)
  await logGdprAction("erase_candidate", "candidate", candidateId, requestedBy, result);

  return result;
}

// ========== Contact Data Protection ==========

/**
 * Scrub contact PII from jobs that reference a specific person.
 * Searches agentContact and recruiterContact JSONB fields by email or name.
 */
export async function scrubContactData(
  identifier: string,
  requestedBy: string = "system",
): Promise<{ scrubbed: number }> {
  const pattern = `%${escapeLike(identifier)}%`;

  // Find jobs where agent or recruiter matches the identifier (email or name)
  const matchingJobs = await db
    .select({
      id: jobs.id,
      agentContact: jobs.agentContact,
      recruiterContact: jobs.recruiterContact,
    })
    .from(jobs)
    .where(
      or(
        sql`${jobs.agentContact}->>'email' ILIKE ${pattern}`,
        sql`${jobs.agentContact}->>'name' ILIKE ${pattern}`,
        sql`${jobs.recruiterContact}->>'email' ILIKE ${pattern}`,
        sql`${jobs.recruiterContact}->>'name' ILIKE ${pattern}`,
      ),
    );

  // Group job IDs by which fields need to be nulled, then batch update per group
  const nullBothIds: string[] = [];
  const nullAgentOnlyIds: string[] = [];
  const nullRecruiterOnlyIds: string[] = [];

  for (const job of matchingJobs) {
    const agent = job.agentContact as { email?: string; name?: string } | null;
    const recruiter = job.recruiterContact as { email?: string; name?: string } | null;

    const matchAgent =
      agent?.email?.toLowerCase() === identifier.toLowerCase() ||
      agent?.name?.toLowerCase() === identifier.toLowerCase();
    const matchRecruiter =
      recruiter?.email?.toLowerCase() === identifier.toLowerCase() ||
      recruiter?.name?.toLowerCase() === identifier.toLowerCase();

    if (matchAgent && matchRecruiter) {
      nullBothIds.push(job.id);
    } else if (matchAgent) {
      nullAgentOnlyIds.push(job.id);
    } else if (matchRecruiter) {
      nullRecruiterOnlyIds.push(job.id);
    }
  }

  const batchOps: Promise<unknown>[] = [];
  if (nullBothIds.length > 0) {
    batchOps.push(
      db
        .update(jobs)
        .set({ agentContact: null, recruiterContact: null })
        .where(inArray(jobs.id, nullBothIds)),
    );
  }
  if (nullAgentOnlyIds.length > 0) {
    batchOps.push(
      db.update(jobs).set({ agentContact: null }).where(inArray(jobs.id, nullAgentOnlyIds)),
    );
  }
  if (nullRecruiterOnlyIds.length > 0) {
    batchOps.push(
      db.update(jobs).set({ recruiterContact: null }).where(inArray(jobs.id, nullRecruiterOnlyIds)),
    );
  }
  await Promise.all(batchOps);
  const scrubbed = nullBothIds.length + nullAgentOnlyIds.length + nullRecruiterOnlyIds.length;

  await logGdprAction("scrub_contact", "contact", identifier, requestedBy, { scrubbed });
  return { scrubbed };
}

/** Exporteer contactdata (agent/recruiter) voor jobs die matchen op identifier. */
export async function exportContactData(
  identifier: string,
  requestedBy: string = "system",
): Promise<{
  identifier: string;
  matches: {
    id: string;
    title: string;
    agentContact: unknown;
    recruiterContact: unknown;
  }[];
}> {
  const pattern = `%${escapeLike(identifier)}%`;
  const matches = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      agentContact: jobs.agentContact,
      recruiterContact: jobs.recruiterContact,
    })
    .from(jobs)
    .where(
      and(
        or(
          sql`${jobs.agentContact}->>'email' ILIKE ${pattern}`,
          sql`${jobs.agentContact}->>'name' ILIKE ${pattern}`,
          sql`${jobs.recruiterContact}->>'email' ILIKE ${pattern}`,
          sql`${jobs.recruiterContact}->>'name' ILIKE ${pattern}`,
        ),
      ),
    );

  await logGdprAction("export_contact", "contact", identifier, requestedBy, {
    matches: matches.length,
  });

  return { identifier, matches };
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

/** Retrieve GDPR audit log entries for a subject. */
export async function getAuditLog(subjectRef: string) {
  return db
    .select()
    .from(gdprAuditLog)
    .where(eq(gdprAuditLog.subjectId, subjectRef))
    .orderBy(gdprAuditLog.createdAt);
}
