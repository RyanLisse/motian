import { createHash } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { uploadFile } from "@/src/lib/file-storage";
import {
  type AllowedMimeType,
  CV_ALLOWED_TYPES,
  type CvPipelineEvent,
  processStoredCV,
} from "@/src/services/cv-analysis-pipeline";
import type { cvAnalysisPipelineTask } from "@/trigger/cv-analysis-pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIZE_MB = 20;

function sseEvent(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function enqueuePipelineEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: CvPipelineEvent,
) {
  controller.enqueue(sseEvent(event));
}

export async function POST(request: NextRequest) {
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
  if (!CV_ALLOWED_TYPES.includes(mimeType as AllowedMimeType)) {
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
  const allowedMimeType = mimeType as AllowedMimeType;
  const asyncRequested = request.nextUrl.searchParams.get("async") === "1";

  if (asyncRequested) {
    const fileHash = createHash("sha256").update(buffer).digest("hex");
    const { url: fileUrl } = await uploadFile(
      buffer,
      `cv/${Date.now()}-${file.name}`,
      allowedMimeType,
    );

    const handle = await tasks.trigger<typeof cvAnalysisPipelineTask>(
      "cv-analysis-pipeline",
      {
        fileUrl,
        fileName: file.name,
        mimeType: allowedMimeType,
        fileHash,
      },
      {
        idempotencyKey: `cv-${fileHash}-pipeline`,
      },
    );

    return Response.json({
      mode: "async",
      runId: handle.id,
      fileUrl,
      statusUrl: `/api/cv-analyse/status/${handle.id}`,
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          sseEvent({ step: "upload", status: "active", label: "CV uploaden naar opslag..." }),
        );

        const { url: fileUrl } = await uploadFile(
          buffer,
          `cv/${Date.now()}-${file.name}`,
          allowedMimeType,
        );

        controller.enqueue(sseEvent({ step: "upload", status: "complete", label: "CV geüpload" }));

        const result = await processStoredCV(
          {
            fileUrl,
            mimeType: allowedMimeType,
          },
          async (event) => {
            enqueuePipelineEvent(controller, event);
          },
        );

        // Structured AI-cost / flow log for baseline and Fase 4
        console.log(
          JSON.stringify({
            flow: "cv_analyse",
            mode: "sync",
            candidateId: result.candidate.id,
            matchCount: result.matches.length,
            isExistingCandidate: result.isExistingCandidate,
          }),
        );

        controller.enqueue(
          sseEvent({
            step: "done",
            result,
          }),
        );

        revalidatePath("/professionals");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Onbekende fout";
        console.error("[CV Analyse] Error:", message, error);
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
