import {
  candidateSkills,
  candidateSkillsV2,
  db,
  eq,
  escoSkills,
  jobSkills,
  jobSkillsV2,
  skills,
  sql,
} from "@/src/db";
import { findOrCreateSkill } from "@/src/services/skills";

async function backfillCandidateSkills() {
  const rows = await db
    .select({
      candidateId: candidateSkills.candidateId,
      rawLabel: escoSkills.preferredLabelNl,
      fallbackLabel: escoSkills.preferredLabelEn,
      source: candidateSkills.source,
      confidence: candidateSkills.confidence,
    })
    .from(candidateSkills)
    .innerJoin(escoSkills, eq(candidateSkills.escoUri, escoSkills.uri));

  for (const row of rows) {
    const label = row.rawLabel ?? row.fallbackLabel;
    const skill = await findOrCreateSkill(label);
    await db
      .insert(candidateSkillsV2)
      .values({
        candidateId: row.candidateId,
        skillId: skill.id,
        rawLabel: label,
        source: row.source,
        confidence: row.confidence,
      })
      .onConflictDoNothing();
  }

  return rows.length;
}

async function backfillJobSkills() {
  const rows = await db
    .select({
      jobId: jobSkills.jobId,
      rawLabel: escoSkills.preferredLabelNl,
      fallbackLabel: escoSkills.preferredLabelEn,
      source: jobSkills.source,
      confidence: jobSkills.confidence,
      required: jobSkills.required,
    })
    .from(jobSkills)
    .innerJoin(escoSkills, eq(jobSkills.escoUri, escoSkills.uri));

  for (const row of rows) {
    const label = row.rawLabel ?? row.fallbackLabel;
    const skill = await findOrCreateSkill(label);
    await db
      .insert(jobSkillsV2)
      .values({
        jobId: row.jobId,
        skillId: skill.id,
        rawLabel: label,
        source: row.source,
        confidence: row.confidence,
        importance: row.required ? "must" : "nice",
      })
      .onConflictDoNothing();
  }

  return rows.length;
}

async function main() {
  const [candidateCount, jobCount, totalSkills] = await Promise.all([
    backfillCandidateSkills(),
    backfillJobSkills(),
    db.select({ count: sql<number>`count(*)::int` }).from(skills),
  ]);

  console.log(
    JSON.stringify(
      {
        candidateCount,
        jobCount,
        skillCount: totalSkills[0]?.count ?? 0,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[backfill-skills-v2] failed", error);
  process.exitCode = 1;
});
