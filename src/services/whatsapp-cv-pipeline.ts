import { eq } from "drizzle-orm";
import { db } from "../db";
import { candidates } from "../db/schema";
import { uploadFile } from "../lib/file-storage";
import { computeGradeFromParsed } from "../lib/grading-utils";
import type { ParsedCV } from "../schemas/candidate-intelligence";
import type { AutoMatchResult } from "./auto-matching";
import { autoMatchCandidateToJobs } from "./auto-matching";
import { createCandidate, enrichCandidateFromCV, findDuplicateCandidate } from "./candidates";
import { parseCV } from "./cv-parser";
import type { IncomingDocument } from "./whatsapp";
import { getWhatsAppGateway } from "./whatsapp";

// ========== Types ==========

export type WhatsAppCVResult = {
  candidateId: string;
  candidateName: string;
  parsed: ParsedCV;
  gradeScore: number;
  gradeLabel: string;
  matches: AutoMatchResult[];
  isExistingCandidate: boolean;
  fileUrl: string;
};

const WHATSAPP_TOP_N = 5;

// ========== Pipeline ==========

/**
 * Process a CV document received via WhatsApp.
 * Reuses the existing CV analysis pipeline:
 * upload → parse → grade → dedup/create candidate → auto-match top 5
 */
export async function processWhatsAppCV(doc: IncomingDocument): Promise<WhatsAppCVResult> {
  const mimeType = doc.mimeType as
    | "application/pdf"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  // Step 1: Upload to blob storage
  const { url: fileUrl } = await uploadFile(
    doc.fileBuffer,
    `cv/whatsapp/${Date.now()}-${doc.fileName}`,
    doc.mimeType,
  );

  // Step 2: Parse CV with Gemini
  const parsed = await parseCV(doc.fileBuffer, mimeType);

  // Step 3: Grade CV
  const { score: gradeScore, label: gradeLabel } = computeGradeFromParsed(parsed);

  // Step 4: Dedup / create candidate
  const duplicates = await findDuplicateCandidate(parsed);
  let candidateId: string;
  let candidateName: string;
  let isExistingCandidate = false;

  if (duplicates.exact) {
    isExistingCandidate = true;
    const enriched = await enrichCandidateFromCV(
      duplicates.exact.id,
      parsed,
      JSON.stringify(parsed),
      fileUrl,
    );
    if (!enriched) throw new Error("Bestaande kandidaat kon niet worden verrijkt");
    candidateId = enriched.id;
    candidateName = enriched.name;
  } else {
    const candidate = await createCandidate({
      name: parsed.name,
      email: parsed.email ?? undefined,
      phone: parsed.phone ?? undefined,
      role: parsed.role,
      skills: [...parsed.skills.hard.map((s) => s.name), ...parsed.skills.soft.map((s) => s.name)],
      location: parsed.location ?? undefined,
      notes: parsed.introduction,
      source: "whatsapp",
    });
    await enrichCandidateFromCV(candidate.id, parsed, JSON.stringify(parsed), fileUrl);
    candidateId = candidate.id;
    candidateName = candidate.name;
  }

  // Step 5: Auto-match top 5 vacatures
  let matches: AutoMatchResult[] = [];
  try {
    matches = await autoMatchCandidateToJobs(candidateId, WHATSAPP_TOP_N);
  } catch (err) {
    console.error("[WhatsApp CV] Auto-matching failed:", err);
  }

  return {
    candidateId,
    candidateName,
    parsed,
    gradeScore,
    gradeLabel,
    matches,
    isExistingCandidate,
    fileUrl,
  };
}

// ========== Response Formatting ==========

/** Format CV analysis result as a Dutch WhatsApp message with emoji. */
export function formatCVResultMessage(result: WhatsAppCVResult): string {
  const { parsed, gradeScore, gradeLabel, matches } = result;

  const lines: string[] = [];

  // Header
  lines.push(`📄 *CV Analyse — ${result.candidateName}*`);
  if (parsed.role) lines.push(`_${parsed.role}_`);
  lines.push("");

  // Grade
  lines.push("━━━ Beoordeling ━━━");
  lines.push(`⭐ Score: ${gradeScore}/100 — ${gradeLabel}`);
  lines.push("");

  // Profile summary
  lines.push("━━━ Profiel ━━━");
  if (parsed.location) lines.push(`📍 ${parsed.location}`);
  if (parsed.highestEducationLevel) lines.push(`🎓 ${parsed.highestEducationLevel}`);
  if (parsed.totalYearsExperience != null) {
    lines.push(`💼 ${parsed.totalYearsExperience} jaar ervaring`);
  }

  const topSkills = parsed.skills.hard
    .slice(0, 5)
    .map((s) => s.name)
    .join(", ");
  if (topSkills) lines.push(`🔧 ${topSkills}`);
  lines.push("");

  // Top 5 matches
  if (matches.length > 0) {
    lines.push("━━━ Top Vacatures ━━━");
    lines.push("");

    const numberEmoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      lines.push(`${numberEmoji[i] ?? `${i + 1}.`} *${m.jobTitle}*`);

      const details: string[] = [];
      if (m.company) details.push(`🏢 ${m.company}`);
      if (m.location) details.push(`📍 ${m.location}`);
      if (details.length > 0) lines.push(`   ${details.join(" | ")}`);

      const score = m.structuredResult?.overallScore ?? m.quickScore;
      const recommendation = m.structuredResult?.recommendation ?? "";
      lines.push(`   📊 Match: ${score}%${recommendation ? ` — ${recommendation}` : ""}`);
      lines.push("");
    }
  } else {
    lines.push("_Geen matching vacatures gevonden op dit moment._");
    lines.push("");
  }

  // Footer
  lines.push("_Stuur een bericht voor meer informatie over een vacature._");
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━");
  lines.push("🤖 _Motian AI Recruitment_");

  // GDPR notice
  lines.push("");
  lines.push("_Je gegevens worden verwerkt conform AVG. Stuur 'verwijder' om je data te wissen._");

  return lines.join("\n");
}

// ========== Full Handler ==========

/**
 * Handle an incoming WhatsApp CV document end-to-end:
 * acknowledge → process → send results
 */
export async function handleWhatsAppCV(doc: IncomingDocument): Promise<void> {
  const gateway = getWhatsAppGateway();

  // Send acknowledgment
  await gateway.sendText(
    doc.senderJid,
    `📥 Bedankt${doc.senderName ? `, ${doc.senderName}` : ""}! Ik analyseer je CV...\n\n⏳ Dit duurt ongeveer 30 seconden.`,
  );

  try {
    const result = await processWhatsAppCV(doc);

    // Send formatted results
    const message = formatCVResultMessage(result);
    await gateway.sendText(doc.senderJid, message);

    console.log(`[WhatsApp CV] Done: ${result.matches.length} matches for ${result.candidateName}`);
  } catch (err) {
    console.error("[WhatsApp CV] Pipeline failed:", {
      error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
      sender: doc.senderPhone,
      fileName: doc.fileName,
      messageId: doc.messageId,
    });

    const errorMsg = err instanceof Error ? err.message : "Onbekende fout";
    await gateway.sendText(
      doc.senderJid,
      `❌ CV analyse mislukt: ${errorMsg}\n\nProbeer het opnieuw of stuur een ander bestand.`,
    );
  }
}

// ========== GDPR Text Handler ==========

const DELETION_COMMANDS = new Set(["verwijder", "delete", "wis mijn gegevens"]);

/**
 * Handle incoming text messages. Responds to GDPR deletion commands.
 */
export async function handleWhatsAppText(phone: string, jid: string, text: string): Promise<void> {
  const normalized = text.toLowerCase().trim();

  if (!DELETION_COMMANDS.has(normalized)) return;

  const gateway = getWhatsAppGateway();

  try {
    // Find candidates by phone number
    const found = await db
      .select({ id: candidates.id, name: candidates.name })
      .from(candidates)
      .where(eq(candidates.phone, phone));

    if (found.length === 0) {
      await gateway.sendText(jid, "ℹ️ Er zijn geen gegevens gevonden voor dit telefoonnummer.");
      return;
    }

    // Soft-delete candidates by setting deletedAt
    for (const c of found) {
      await db.update(candidates).set({ deletedAt: new Date() }).where(eq(candidates.id, c.id));
    }

    await gateway.sendText(
      jid,
      `✅ Je gegevens zijn verwijderd uit ons systeem conform AVG (${found.length} profiel${found.length > 1 ? "en" : ""}).`,
    );

    console.log(`[WhatsApp GDPR] Deleted ${found.length} candidate(s) for phone ${phone}`);
  } catch (err) {
    console.error("[WhatsApp GDPR] Deletion failed:", err);
    await gateway.sendText(jid, "❌ Er is een fout opgetreden. Neem contact met ons op.");
  }
}
