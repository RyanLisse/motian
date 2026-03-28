import type { NextRequest } from "next/server";
import { validateCvUploadFile } from "@/src/lib/cv-upload";
import { uploadFile } from "@/src/lib/file-storage";
import { rateLimit } from "@/src/lib/rate-limit";
import { findDuplicateCandidate } from "@/src/services/candidates";
import { parseCV } from "@/src/services/cv-parser";
import { extractClientIp, requireBlobToken } from "../_shared/cv-helpers";

export const dynamic = "force-dynamic";

const limiter = rateLimit({ interval: 60_000, limit: 10 });

export async function POST(request: NextRequest) {
  const ip = extractClientIp(request);
  const { success, reset } = limiter.check(ip);
  if (!success) {
    return Response.json(
      { error: "Te veel verzoeken. Probeer het later opnieuw." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } },
    );
  }

  try {
    const blobError = requireBlobToken();
    if (blobError) {
      console.error("[CV Upload] BLOB_READ_WRITE_TOKEN is not configured");
      return blobError;
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

    // Upload to blob storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url: fileUrl } = await uploadFile(
      buffer,
      `cv/${Date.now()}-${file.name}`,
      validation.mimeType,
    );

    // Parse CV with Gemini
    const parsed = await parseCV(buffer, validation.mimeType);

    // Check for duplicates
    const duplicates = await findDuplicateCandidate(parsed);

    return Response.json(
      {
        parsed,
        fileUrl,
        duplicates: {
          exact: duplicates.exact,
          similar: duplicates.similar,
        },
      },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    console.error("[CV Upload] Error:", message, err);
    return Response.json({ error: `CV verwerking mislukt: ${message}` }, { status: 500 });
  }
}
