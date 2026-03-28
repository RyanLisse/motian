import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { parsedCVSchema } from "@/src/schemas/candidate-intelligence";
import { intakeCandidate } from "@/src/services/candidate-intake";
import { getCandidateById } from "@/src/services/candidates";

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
    if (existingCandidateId) {
      const existingCandidate = await getCandidateById(existingCandidateId);
      if (!existingCandidate) {
        return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
      }
    }

    const intake = await intakeCandidate({
      existingCandidateId,
      parsed,
      resumeRaw,
      fileUrl,
    });

    revalidatePath("/kandidaten");
    revalidatePath("/vacatures");
    revalidatePath("/overzicht");
    revalidatePath(`/kandidaten/${intake.candidate.id}`);

    return Response.json(
      {
        message: existingCandidateId ? "Kandidaat verrijkt" : "Kandidaat aangemaakt",
        candidate: intake.candidate,
        profile: intake.profile,
        matches: intake.matches,
        recommendation: intake.recommendation,
        matchingStatus: intake.matchingStatus,
        alreadyLinked: intake.alreadyLinked,
        fileUrl,
        candidateId: intake.candidate.id,
      },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  } catch (err) {
    console.error("[CV Save]", err);

    if (err instanceof Error && err.message === "Kandidaat niet gevonden") {
      return Response.json({ error: err.message }, { status: 404 });
    }

    return Response.json({ error: "Opslaan mislukt" }, { status: 500 });
  }
}
