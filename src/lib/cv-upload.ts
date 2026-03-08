export const CV_UPLOAD_MAX_SIZE_MB = 20;
export const CV_UPLOAD_MAX_SIZE_BYTES = CV_UPLOAD_MAX_SIZE_MB * 1024 * 1024;

export const SUPPORTED_CV_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const LEGACY_DOC_MIME_TYPES = [
  "application/doc",
  "application/msword",
  "application/vnd.ms-word",
] as const;

export type SupportedCvMimeType = (typeof SUPPORTED_CV_MIME_TYPES)[number];

export const CV_UPLOAD_ACCEPT = [
  ".pdf",
  ".doc",
  ".docx",
  ...SUPPORTED_CV_MIME_TYPES,
  ...LEGACY_DOC_MIME_TYPES,
].join(",");

type CvUploadFileLike = {
  name: string;
  type: string;
  size: number;
};

type ParsedCvSummary = {
  name: string;
  role: string;
  skills: {
    hard: Array<{ name: string }>;
    soft: Array<{ name: string }>;
  };
};

export type CvUploadValidationResult =
  | { ok: true; mimeType: SupportedCvMimeType }
  | {
      ok: false;
      code: "file_too_large" | "unsupported_doc" | "unsupported_type";
      message: string;
    };

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export function validateCvUploadFile(file: CvUploadFileLike): CvUploadValidationResult {
  if (file.size > CV_UPLOAD_MAX_SIZE_BYTES) {
    return {
      ok: false,
      code: "file_too_large",
      message: `Bestand te groot. Maximaal ${CV_UPLOAD_MAX_SIZE_MB}MB toegestaan.`,
    };
  }

  const mimeType = file.type.trim().toLowerCase();
  const extension = getFileExtension(file.name);

  if (mimeType === "application/pdf" || extension === ".pdf") {
    return { ok: true, mimeType: "application/pdf" };
  }

  if (extension === ".docx") {
    return {
      ok: true,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  if (extension === ".doc" || LEGACY_DOC_MIME_TYPES.includes(mimeType as never)) {
    return {
      ok: false,
      code: "unsupported_doc",
      message:
        "Oudere Word-bestanden (.doc) worden nog niet ondersteund. Gebruik een PDF of .docx-bestand.",
    };
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return {
      ok: true,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  return {
    ok: false,
    code: "unsupported_type",
    message: "Alleen PDF en Word (.docx) bestanden zijn toegestaan.",
  };
}

export function buildCvSummaryMessage({
  candidateId,
  duplicates,
  parsed,
}: {
  candidateId: string;
  duplicates: { exact?: { id: string } } | undefined;
  parsed: ParsedCvSummary;
}) {
  const action = duplicates?.exact ? "bijgewerkt" : "toegevoegd aan talentpool";
  const skillsList = [...parsed.skills.hard, ...parsed.skills.soft]
    .map((skill) => skill.name)
    .slice(0, 8)
    .join(", ");

  return {
    action,
    text: `Ik heb zojuist een CV geüpload voor ${parsed.name} (${parsed.role}). Het profiel is automatisch ${action}. Vaardigheden: ${skillsList}. Kandidaat ID: ${candidateId}. Geef een samenvatting van dit profiel en zoek passende vacatures.`,
  };
}
