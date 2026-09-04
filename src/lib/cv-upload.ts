import type { Buffer } from "node:buffer";
import type { CandidateIntakeMatch } from "@/src/services/candidate-intake";

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

const PDF_HEADER = "%PDF-";
const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const DOCX_MAIN_DOCUMENT = "word/document.xml";
const MAX_DOCX_ENTRIES = 512;
const MAX_DOCX_ENTRY_NAME_LENGTH = 260;
const MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_DOCX_COMPRESSION_RATIO = 100;

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
      code: "file_too_large" | "unsupported_doc" | "unsupported_type" | "invalid_content";
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

  // Check for .docx BEFORE rejecting legacy formats
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === ".docx"
  ) {
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

  return {
    ok: false,
    code: "unsupported_type",
    message: "Alleen PDF en Word (.docx) bestanden zijn toegestaan.",
  };
}

function invalidContent(
  message = "Bestandstype komt niet overeen met de inhoud.",
): CvUploadValidationResult {
  return { ok: false, code: "invalid_content", message };
}

function hasPdfHeader(buffer: Buffer): boolean {
  if (buffer.length < PDF_HEADER.length) return false;
  return buffer.subarray(0, PDF_HEADER.length).toString("ascii") === PDF_HEADER;
}

type DocxZipEntry = {
  entryName: string;
  uncompressedSize: number;
  nextOffset: number;
};

type DocxZipEntryResult = { ok: true; entry: DocxZipEntry } | { ok: false; message: string };

// Reads and validates a single ZIP local file entry starting at `offset`.
function readDocxZipEntry(buffer: Buffer, offset: number): DocxZipEntryResult {
  const compressedSize = buffer.readUInt32LE(offset + 18);
  const uncompressedSize = buffer.readUInt32LE(offset + 22);
  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const nameStart = offset + 30;
  const nameEnd = nameStart + fileNameLength;

  if (nameEnd > buffer.length || fileNameLength > MAX_DOCX_ENTRY_NAME_LENGTH) {
    return { ok: false, message: "Word-bestand bevat een ongeldige bestandsnaam." };
  }

  const entryName = buffer.subarray(nameStart, nameEnd).toString("utf8");
  if (entryName.includes("..") || entryName.startsWith("/") || entryName.includes("\\")) {
    return { ok: false, message: "Word-bestand bevat onveilige paden." };
  }

  if (compressedSize > 0 && uncompressedSize / compressedSize > MAX_DOCX_COMPRESSION_RATIO) {
    return { ok: false, message: "Word-bestand heeft een verdachte compressieverhouding." };
  }

  return {
    ok: true,
    entry: { entryName, uncompressedSize, nextOffset: nameEnd + extraLength + compressedSize },
  };
}

type DocxZipScanResult =
  | { ok: true; entries: number; hasDocumentXml: boolean; offset: number }
  | { ok: false; message: string };

// Walks the ZIP local file entries, enforcing entry count, size, and
// zip-bomb (compression ratio) limits along the way.
function scanDocxZipEntries(buffer: Buffer): DocxZipScanResult {
  let offset = 0;
  let entries = 0;
  let totalUncompressed = 0;
  let hasDocumentXml = false;

  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === ZIP_LOCAL_FILE_HEADER) {
    const result = readDocxZipEntry(buffer, offset);
    if (!result.ok) return result;

    entries++;
    if (entries > MAX_DOCX_ENTRIES) {
      return { ok: false, message: "Word-bestand bevat te veel interne bestanden." };
    }

    totalUncompressed += result.entry.uncompressedSize;
    if (totalUncompressed > MAX_DOCX_UNCOMPRESSED_BYTES) {
      return { ok: false, message: "Word-bestand is uitgepakt te groot." };
    }

    if (result.entry.entryName === DOCX_MAIN_DOCUMENT) {
      hasDocumentXml = true;
    }

    offset = result.entry.nextOffset;
  }

  return { ok: true, entries, hasDocumentXml, offset };
}

function validateDocxZip(buffer: Buffer): CvUploadValidationResult {
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== ZIP_LOCAL_FILE_HEADER) {
    return invalidContent("Word-bestand heeft geen geldige DOCX-container.");
  }

  const scan = scanDocxZipEntries(buffer);
  if (!scan.ok) {
    return invalidContent(scan.message);
  }

  if (!scan.hasDocumentXml || scan.entries === 0) {
    return invalidContent("Word-bestand mist de verwachte documentinhoud.");
  }

  if (
    scan.offset + 4 <= buffer.length &&
    buffer.readUInt32LE(scan.offset) !== ZIP_CENTRAL_DIRECTORY_HEADER
  ) {
    return invalidContent("Word-bestand heeft een ongeldige ZIP-structuur.");
  }

  return {
    ok: true,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}

export function validateCvUploadBuffer(
  file: CvUploadFileLike,
  buffer: Buffer,
): CvUploadValidationResult {
  const metadata = validateCvUploadFile(file);
  if (!metadata.ok) return metadata;

  if (metadata.mimeType === "application/pdf") {
    return hasPdfHeader(buffer)
      ? metadata
      : invalidContent("PDF-bestand heeft geen geldige PDF-header.");
  }

  return validateDocxZip(buffer);
}

export function buildCvSummaryMessage({
  candidateId,
  duplicates,
  parsed,
  matches,
}: {
  candidateId: string;
  duplicates: { exact?: { id: string } } | undefined;
  parsed: ParsedCvSummary;
  matches?: CandidateIntakeMatch[];
}): { action: string; text: string; candidateUrl: string } {
  const action = duplicates?.exact ? "bijgewerkt" : "toegevoegd aan talentpool";
  const skillsList = [...parsed.skills.hard, ...parsed.skills.soft]
    .map((skill) => skill.name)
    .slice(0, 8)
    .join(", ");

  const candidateUrl = `/kandidaten/${candidateId}`;

  const hasMatches = matches && matches.length > 0;
  const profileSkillsUrl = `${candidateUrl}#vaardigheden`;

  let text = `Ik heb zojuist een CV geüpload voor ${parsed.name} (${parsed.role}). Het profiel is automatisch ${action}. Vaardigheden: ${skillsList}. Kandidaat ID: ${candidateId}.`;

  if (hasMatches) {
    const badgeMap: Record<string, string> = {
      go: "\u2705",
      "no-go": "\u274C",
      conditional: "\u26A0\uFE0F",
    };

    const matchLines = matches.map((m) => {
      const badge = m.recommendation ? (badgeMap[m.recommendation] ?? "") : "";
      const company = m.company ? ` (${m.company})` : "";
      return `- ${m.jobTitle}${company} \u2014 Score: ${m.quickScore}, Advies: ${badge}`;
    });

    text += ` Gevonden matches:\n${matchLines.join("\n")}\n\nBekijk alle geëxtraheerde vaardigheden op ${profileSkillsUrl}. Toon daarna een samenvatting met de gevonden matches.`;
  } else {
    text += ` Bekijk alle geëxtraheerde vaardigheden op ${profileSkillsUrl}. Geef daarna een samenvatting van dit profiel en zoek passende vacatures.`;
  }

  return { action, text, candidateUrl };
}
