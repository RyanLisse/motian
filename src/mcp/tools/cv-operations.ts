import { createHash } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { cvAnalysisPipelineTask } from "@/trigger/cv-analysis-pipeline";
import { db, eq } from "../../db";
import { candidates } from "../../db/schema";
import { uploadFile } from "../../lib/file-storage";
import { getCandidateById } from "../../services/candidates";
import type { AllowedMimeType } from "../../services/cv-analysis-pipeline";

// ========== Schemas ==========

const uploadCvSchema = z.object({
  candidateId: z.string().uuid().describe("UUID van de kandidaat"),
  fileName: z.string().min(1).describe("Oorspronkelijke bestandsnaam (bijv. 'cv-jan.pdf')"),
  fileBase64: z.string().min(1).describe("Base64-gecodeerde bestandsinhoud (PDF of DOCX)"),
});

const analyseerCvSchema = z.object({
  candidateId: z.string().uuid().describe("UUID van de kandidaat"),
});

const cvStatusSchema = z.object({
  candidateId: z.string().uuid().describe("UUID van de kandidaat"),
});

// ========== Helpers ==========

function detectMimeType(fileName: string): AllowedMimeType | null {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return null;
}

// ========== Tool Definitions ==========

export const tools = [
  {
    name: "upload_cv",
    description:
      "Upload een CV (PDF/DOCX) voor een bestaande kandidaat. Het bestand wordt opgeslagen en het resumeUrl-veld van de kandidaat wordt bijgewerkt.",
    inputSchema: zodToJsonSchema(uploadCvSchema, { $refStrategy: "none" }),
  },
  {
    name: "analyseer_cv",
    description:
      "Start de CV-analysepijplijn voor een kandidaat. De kandidaat moet al een CV hebben (resumeUrl). De analyse draait op de achtergrond via Trigger.dev.",
    inputSchema: zodToJsonSchema(analyseerCvSchema, { $refStrategy: "none" }),
  },
  {
    name: "cv_status",
    description:
      "Controleer de CV-analysestatus voor een kandidaat. Geeft geparseerde vaardigheden, ervaring, opleiding en meer terug als de analyse klaar is.",
    inputSchema: zodToJsonSchema(cvStatusSchema, { $refStrategy: "none" }),
  },
];

// ========== Handlers ==========

export const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  upload_cv: async (raw) => {
    const { candidateId, fileName, fileBase64 } = uploadCvSchema.parse(raw);

    // Validate candidate exists
    const candidate = await getCandidateById(candidateId);
    if (!candidate) return { error: "Kandidaat niet gevonden" };

    // Detect mime type from filename
    const mimeType = detectMimeType(fileName);
    if (!mimeType) {
      return {
        error: "Ongeldig bestandstype. Alleen PDF (.pdf) en Word (.docx) zijn toegestaan.",
      };
    }

    // Decode base64 to buffer
    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileBase64, "base64");
    } catch {
      return { error: "Ongeldige base64-codering" };
    }

    if (buffer.length === 0) {
      return { error: "Leeg bestand ontvangen" };
    }

    // Upload to blob storage
    const { url: fileUrl } = await uploadFile(buffer, `cv/${Date.now()}-${fileName}`, mimeType);

    // Update candidate's resumeUrl directly (not part of CreateCandidateData)
    await db
      .update(candidates)
      .set({ resumeUrl: fileUrl, updatedAt: new Date() })
      .where(eq(candidates.id, candidateId));

    revalidatePath("/kandidaten");
    revalidatePath(`/kandidaten/${candidateId}`);

    return {
      success: true,
      candidateId,
      fileUrl,
      message: `CV '${fileName}' geüpload voor kandidaat ${candidate.name}`,
    };
  },

  analyseer_cv: async (raw) => {
    const { candidateId } = analyseerCvSchema.parse(raw);

    // Validate candidate exists
    const candidate = await getCandidateById(candidateId);
    if (!candidate) return { error: "Kandidaat niet gevonden" };

    // Check if candidate has a resume URL
    if (!candidate.resumeUrl) {
      return {
        error: "Kandidaat heeft geen CV. Upload eerst een CV met de upload_cv tool.",
      };
    }

    // Detect mime type from the stored URL filename
    const urlFileName = candidate.resumeUrl.split("/").pop() ?? "";
    const mimeType = detectMimeType(urlFileName) ?? "application/pdf";

    // Create a file hash for idempotency
    const fileHash = createHash("sha256").update(candidate.resumeUrl).digest("hex");

    // Trigger the CV analysis pipeline via Trigger.dev
    const handle = await tasks.trigger<typeof cvAnalysisPipelineTask>(
      "cv-analysis-pipeline",
      {
        fileUrl: candidate.resumeUrl,
        fileName: urlFileName,
        mimeType: mimeType as AllowedMimeType,
        fileHash,
      },
      {
        idempotencyKey: `cv-${fileHash}-mcp`,
      },
    );

    return {
      status: "processing",
      candidateId,
      runId: handle.id,
      message: `CV-analyse gestart voor ${candidate.name}. Gebruik cv_status om de voortgang te controleren.`,
    };
  },

  cv_status: async (raw) => {
    const { candidateId } = cvStatusSchema.parse(raw);

    // Validate candidate exists
    const candidate = await getCandidateById(candidateId);
    if (!candidate) return { error: "Kandidaat niet gevonden" };

    if (!candidate.resumeUrl && !candidate.resumeRaw) {
      return {
        candidateId,
        status: "geen_cv",
        message: "Kandidaat heeft geen CV geüpload.",
      };
    }

    if (candidate.resumeUrl && !candidate.resumeParsedAt) {
      return {
        candidateId,
        status: "wacht_op_analyse",
        resumeUrl: candidate.resumeUrl,
        message:
          "CV is geüpload maar nog niet geanalyseerd. Gebruik analyseer_cv om de analyse te starten.",
      };
    }

    // CV has been analysed -- return structured data
    const structured = candidate.skillsStructured as {
      hard?: unknown;
      soft?: unknown;
      totalYearsExperience?: unknown;
      highestEducationLevel?: unknown;
      industries?: unknown;
    } | null;

    return {
      candidateId,
      status: "geanalyseerd",
      resumeUrl: candidate.resumeUrl,
      resumeParsedAt: candidate.resumeParsedAt,
      profiel: {
        naam: candidate.name,
        rol: candidate.role,
        locatie: candidate.location,
        vaardigheden: candidate.skills,
        structuur: structured
          ? {
              hard: structured.hard,
              soft: structured.soft,
              totalenJarenErvaring: structured.totalYearsExperience,
              hoogsteOpleiding: structured.highestEducationLevel,
              branches: structured.industries,
            }
          : null,
        ervaring: candidate.experience,
        opleiding: candidate.education,
        certificeringen: candidate.certifications,
        talen: candidate.languageSkills,
        samenvatting: candidate.profileSummary,
      },
    };
  },
};
