import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { parsedCVSchema } from "@/src/schemas/candidate-intelligence";
import { autoMatchCandidateToJobs } from "@/src/services/auto-matching";
import { type Candidate, createCandidate, enrichCandidateFromCV } from "@/src/services/candidates";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  parsed: parsedCVSchema,
  fileUrl: z.string().url(),
  existingCandidateId: z.string().uuid().optional(),
  resumeRaw: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = saveSchema.safeParse(body);
    if (!result.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { parsed, fileUrl, existingCandidateId, resumeRaw } = result.data;

    let candidate: Candidate | null = null;

    if (existingCandidateId) {
      // Enrich existing candidate
      candidate = await enrichCandidateFromCV(
        existingCandidateId,
        parsed,
        resumeRaw ?? "",
        fileUrl,
      );
      if (!candidate) {
        return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
      }
    } else {
      // Create new candidate (profileSummary = AI-samenvatting uit CV, notes voor vrije notities)
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
        profileSummary: parsed.introduction,
        source: "cv-upload",
      });

      // Enrich with structured data + store CV file URL (zet ook profileSummary bij bestaande)
      if (candidate) {
        await enrichCandidateFromCV(candidate.id, parsed, resumeRaw ?? "", fileUrl);
      }
    }

    // Auto-match met vacatures zodat matches op het profiel zichtbaar zijn
    if (candidate) {
      try {
        await autoMatchCandidateToJobs(candidate.id, 5);
      } catch (err) {
        console.warn("[CV Save] Auto-match overgeslagen:", err);
      }
      revalidatePath("/kandidaten");
      revalidatePath(`/kandidaten/${candidate.id}`);
    }

    return Response.json({
      message: existingCandidateId ? "Kandidaat verrijkt" : "Kandidaat aangemaakt",
      candidate,
      fileUrl,
      candidateId: candidate?.id ?? null,
    });
  } catch (err) {
    console.error("[CV Save]", err);
    return Response.json({ error: "Opslaan mislukt" }, { status: 500 });
  }
}
