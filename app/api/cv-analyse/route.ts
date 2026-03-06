import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { uploadFile } from "@/src/lib/file-storage";
import { computeGradeFromParsed } from "@/src/lib/grading-utils";
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

function sseEvent(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: NextRequest) {
  // Pre-validate before starting the stream (these return JSON errors)
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[CV Analyse] BLOB_READ_WRITE_TOKEN is not configured");
    return Response.json(
      { error: "Bestandsopslag is niet geconfigureerd. Stel BLOB_READ_WRITE_TOKEN in." },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("cv") as File | null;

  if (!file) {
    return Response.json({ error: "Geen bestand ontvangen" }, { status: 400 });
  }

  const mimeType = file.type;
  if (!ALLOWED_TYPES.includes(mimeType as AllowedMimeType)) {
    return Response.json(
      { error: "Ongeldig bestandstype. Alleen PDF en Word (.docx) zijn toegestaan." },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return Response.json(
      { error: `Bestand te groot. Maximaal ${MAX_SIZE_MB}MB toegestaan.` },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Upload
        controller.enqueue(
          sseEvent({ step: "upload", status: "active", label: "CV uploaden naar opslag..." }),
        );
        const { url: fileUrl } = await uploadFile(
          buffer,
          `cv/${Date.now()}-${file.name}`,
          mimeType,
        );
        controller.enqueue(sseEvent({ step: "upload", status: "complete", label: "CV geüpload" }));

        // Step 2: Parse
        controller.enqueue(
          sseEvent({ step: "parse", status: "active", label: "CV analyseren met AI..." }),
        );
        const parsed = await parseCV(buffer, mimeType as AllowedMimeType);
        controller.enqueue(
          sseEvent({
            step: "parse",
            status: "complete",
            label: `CV geanalyseerd`,
            detail: `${parsed.name}${parsed.role ? ` — ${parsed.role}` : ""}`,
          }),
        );

        // Step 2: Grade (expliciete beoordelingsfase op basis van parsed CV)
        controller.enqueue(
          sseEvent({ step: "grade", status: "active", label: "CV beoordelen..." }),
        );
        const gradeScore = computeGradeFromParsed(parsed);
        controller.enqueue(
          sseEvent({
            step: "grade",
            status: "complete",
            label: "CV beoordeeld",
            detail: `${gradeScore.score}/100 — ${gradeScore.label}`,
            gradeScore: gradeScore.score,
            gradeLabel: gradeScore.label,
          }),
        );

        // Step 3: Deduplicate
        controller.enqueue(
          sseEvent({ step: "deduplicate", status: "active", label: "Kandidaat controleren..." }),
        );
        const duplicates = await findDuplicateCandidate(parsed);

        let candidate: { id: string; name: string } | null | undefined;
        if (duplicates.exact) {
          candidate = await enrichCandidateFromCV(
            duplicates.exact.id,
            parsed,
            JSON.stringify(parsed),
            fileUrl,
          );
          if (!candidate) {
            controller.enqueue(
              sseEvent({
                step: "deduplicate",
                status: "error",
                label: "Bestaande kandidaat kon niet worden verrijkt",
              }),
            );
            controller.close();
            return;
          }
          controller.enqueue(
            sseEvent({
              step: "deduplicate",
              status: "complete",
              label: "Bestaande kandidaat gevonden",
              detail: candidate.name,
            }),
          );
        } else {
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
          await enrichCandidateFromCV(candidate.id, parsed, JSON.stringify(parsed), fileUrl);
          controller.enqueue(
            sseEvent({
              step: "deduplicate",
              status: "complete",
              label: "Nieuwe kandidaat aangemaakt",
              detail: candidate.name,
            }),
          );
        }

        // Step 4: Match
        controller.enqueue(
          sseEvent({ step: "match", status: "active", label: "Matchen met vacatures..." }),
        );
        let matches: Awaited<ReturnType<typeof autoMatchCandidateToJobs>> = [];
        try {
          matches = await autoMatchCandidateToJobs(candidate.id);
        } catch (err) {
          console.error("[CV Analyse] Auto-matching mislukt:", err);
        }
        controller.enqueue(
          sseEvent({
            step: "match",
            status: "complete",
            label: `${matches.length} vacature${matches.length === 1 ? "" : "s"} gematcht`,
          }),
        );

        console.log(`[CV Analyse] Done: ${matches.length} matches for candidate ${candidate.id}`);

        // Final event: full result
        controller.enqueue(
          sseEvent({
            step: "done",
            result: {
              candidate,
              matches,
              fileUrl,
              parsed,
              isExistingCandidate: !!duplicates.exact,
            },
          }),
        );

        revalidatePath("/kandidaten");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Onbekende fout";
        console.error("[CV Analyse] Error:", message, err);
        controller.enqueue(sseEvent({ step: "error", label: `CV analyse mislukt: ${message}` }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
