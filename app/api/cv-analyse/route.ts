import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { uploadFile } from "@/src/lib/file-storage";
import { autoMatchCandidateToJobs } from "@/src/services/auto-matching";
import {
  createCandidate,
  enrichCandidateFromCV,
  findDuplicateCandidate,
} from "@/src/services/candidates";
import { parseCV } from "@/src/services/cv-parser";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

type AllowedMimeType = (typeof ALLOWED_TYPES)[number];

const MAX_SIZE_MB = 20;

export async function POST(request: NextRequest) {
  try {
    // 1. Validate env
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("[CV Analyse] BLOB_READ_WRITE_TOKEN is not configured");
      return Response.json(
        { error: "Bestandsopslag is niet geconfigureerd. Stel BLOB_READ_WRITE_TOKEN in." },
        { status: 503 },
      );
    }

    // 2. Get file from FormData
    const formData = await request.formData();
    const file = formData.get("cv") as File | null;

    if (!file) {
      return Response.json({ error: "Geen bestand ontvangen" }, { status: 400 });
    }

    // Validate type
    const mimeType = file.type;
    if (!ALLOWED_TYPES.includes(mimeType as AllowedMimeType)) {
      return Response.json(
        { error: "Ongeldig bestandstype. Alleen PDF en Word (.docx) zijn toegestaan." },
        { status: 400 },
      );
    }

    // Validate size
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return Response.json(
        { error: `Bestand te groot. Maximaal ${MAX_SIZE_MB}MB toegestaan.` },
        { status: 400 },
      );
    }

    // 3. Upload to blob storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url: fileUrl } = await uploadFile(buffer, `cv/${Date.now()}-${file.name}`, mimeType);

    // 4. Parse CV with Gemini
    const parsed = await parseCV(buffer, mimeType as AllowedMimeType);

    // 5. Find duplicates
    const duplicates = await findDuplicateCandidate(parsed);

    // 6. Create or enrich candidate
    let candidate;

    if (duplicates.exact) {
      // Exact duplicate found (email match) — enrich existing candidate
      candidate = await enrichCandidateFromCV(
        duplicates.exact.id,
        parsed,
        JSON.stringify(parsed),
        fileUrl,
      );
      if (!candidate) {
        return Response.json(
          { error: "Bestaande kandidaat kon niet worden verrijkt" },
          { status: 500 },
        );
      }
    } else {
      // Create new candidate
      candidate = await createCandidate({
        name: parsed.name,
        email: parsed.email ?? undefined,
        phone: parsed.phone ?? undefined,
        role: parsed.role,
        skills: [
          ...parsed.skills.hard.map((s) => s.name),
          ...parsed.skills.soft.map((s) => s.name),
        ],
        location: parsed.location ?? undefined,
        notes: parsed.introduction,
        source: "cv-analyse",
      });

      // Enrich with structured data + store CV file URL
      await enrichCandidateFromCV(candidate.id, parsed, JSON.stringify(parsed), fileUrl);
    }

    // 7. Auto-match against active jobs
    let matches: Awaited<ReturnType<typeof autoMatchCandidateToJobs>> = [];
    try {
      matches = await autoMatchCandidateToJobs(candidate.id);
    } catch (err) {
      console.error("[CV Analyse] Auto-matching mislukt:", err);
      // Non-fatal: return candidate + parsed data even if matching fails
    }

    revalidatePath("/professionals");

    return Response.json({
      candidate,
      matches,
      fileUrl,
      parsed,
      isExistingCandidate: !!duplicates.exact,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    console.error("[CV Analyse] Error:", message, err);
    return Response.json({ error: `CV analyse mislukt: ${message}` }, { status: 500 });
  }
}
