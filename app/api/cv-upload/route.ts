import type { NextRequest } from "next/server";
import { validateCvUploadFile } from "@/src/lib/cv-upload";
import { uploadFile } from "@/src/lib/file-storage";
import { rateLimit } from "@/src/lib/rate-limit";
import { findDuplicateCandidate } from "@/src/services/candidates";
import { parseCV } from "@/src/services/cv-parser";

export const dynamic = "force-dynamic";

const limiter = rateLimit({ interval: 60_000, limit: 10 });

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "anonymous";
  const { success, reset } = limiter.check(ip);
  if (!success) {
    return Response.json(
      { error: "Te veel verzoeken. Probeer het later opnieuw." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } },
    );
  }

  try {
    // Early check for required env vars
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("[CV Upload] BLOB_READ_WRITE_TOKEN is not configured");
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

    const validation = validateCvUploadFile(file);
    if (!validation.ok) {
      return Response.json({ error: validation.message }, { status: 400 });
    }

    const mimeType = validation.mimeType;

    // Upload to blob storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url: fileUrl } = await uploadFile(buffer, `cv/${Date.now()}-${file.name}`, mimeType);

    // Parse CV with Gemini
    const parsed = await parseCV(
      buffer,
      mimeType as
        | "application/pdf"
        | "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    // Check for duplicates
    const duplicates = await findDuplicateCandidate(parsed);

    return Response.json({
      parsed,
      fileUrl,
      duplicates: {
        exact: duplicates.exact,
        similar: duplicates.similar,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    console.error("[CV Upload] Error:", message, err);
    return Response.json({ error: `CV verwerking mislukt: ${message}` }, { status: 500 });
  }
}
