/**
 * Shared helpers for CV API routes (cv-analyse, cv-file, cv-upload).
 */

/**
 * Returns a 503 Response if BLOB_READ_WRITE_TOKEN is missing, null if OK.
 */
export function requireBlobToken(): Response | null {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "Bestandsopslag is niet geconfigureerd. Stel BLOB_READ_WRITE_TOKEN in." },
      { status: 503 },
    );
  }
  return null;
}

/**
 * Extract client IP from x-real-ip / x-forwarded-for headers.
 */
export function extractClientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "anonymous"
  );
}

type ValidateFileSuccess = {
  ok: true;
  file: File;
  buffer: Buffer;
  mimeType: string;
};

type ValidateFileFailure = {
  ok: false;
  response: Response;
};

/**
 * Extract and validate a file from FormData: null check, mime check, size check.
 * Returns the File, its Buffer, and validated mimeType on success, or a Response on failure.
 */
export async function validateFileFromForm(
  formData: FormData,
  fieldName: string,
  opts: { allowedTypes: string[]; maxSizeMB: number },
): Promise<ValidateFileSuccess | ValidateFileFailure> {
  const file = formData.get(fieldName) as File | null;

  if (!file) {
    return {
      ok: false,
      response: Response.json({ error: "Geen bestand ontvangen" }, { status: 400 }),
    };
  }

  const mimeType = file.type;
  if (!opts.allowedTypes.includes(mimeType)) {
    return {
      ok: false,
      response: Response.json(
        { error: "Ongeldig bestandstype. Alleen PDF en Word (.docx) zijn toegestaan." },
        { status: 400 },
      ),
    };
  }

  if (file.size > opts.maxSizeMB * 1024 * 1024) {
    return {
      ok: false,
      response: Response.json(
        { error: `Bestand te groot. Maximaal ${opts.maxSizeMB}MB toegestaan.` },
        { status: 400 },
      ),
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return { ok: true, file, buffer, mimeType };
}
