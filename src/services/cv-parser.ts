import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import mammoth from "mammoth";
import { withRetry } from "../lib/retry";
import { type ParsedCV, parsedCVSchema } from "../schemas/candidate-intelligence";

const SYSTEM_PROMPT = `Je bent een CV-parser voor een Nederlands recruitment platform. Analyseer dit CV en extraheer alle relevante informatie.

Voor VAARDIGHEDEN:
- Schat het vaardigheidsniveau in (1=beginner, 5=expert) op basis van jaren ervaring, projecten, en certificeringen vermeld in het CV
- Onderscheid harde vaardigheden (technisch, tools, programmeertalen, methodologieën) en zachte vaardigheden (communicatie, leiderschap, samenwerking, probleemoplossend vermogen)
- Geef bij evidence de specifieke tekst uit het CV die het niveau rechtvaardigt

Voor ERVARING:
- Lijst alle werkposities chronologisch (meest recent eerst)
- startYear en endYear als getallen. Gebruik null als onbekend

Voor TALEN:
- Gebruik CEFR-niveaus (A1, A2, B1, B2, C1, C2) of "native"
- Als niveau niet expliciet vermeld, schat in op basis van context

Wees nauwkeurig. Als informatie ontbreekt, gebruik null. Gok niet.`;

/** Extract text from a Word (.docx) buffer */
async function extractWordText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/** Parse a CV from a file buffer (PDF or Word) */
export async function parseCV(
  fileBuffer: Buffer,
  mimeType:
    | "application/pdf"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
): Promise<ParsedCV> {
  if (mimeType === "application/pdf") {
    const { object } = await withRetry(
      () =>
        generateObject({
          model: google("gemini-3.1-pro"),
          schema: parsedCVSchema,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                { type: "file", data: fileBuffer, mediaType: "application/pdf" },
                { type: "text", text: "Analyseer dit CV en extraheer alle informatie." },
              ],
            },
          ],
          providerOptions: { google: { structuredOutputs: true } },
        }),
      { label: "CV Parser (PDF)" },
    );

    return object;
  }

  // Word document: extract text first, then send as plain text
  const text = await extractWordText(fileBuffer);

  const { object } = await withRetry(
    () =>
      generateObject({
        model: google("gemini-3.1-pro"),
        schema: parsedCVSchema,
        system: SYSTEM_PROMPT,
        prompt: `Analyseer dit CV en extraheer alle informatie.\n\n${text}`,
        providerOptions: { google: { structuredOutputs: true } },
      }),
    { label: "CV Parser (Word)" },
  );

  return object;
}
