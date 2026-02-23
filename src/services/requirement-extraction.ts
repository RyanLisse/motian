import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { withRetry } from "../lib/retry";
import { type ClassifiedRequirement, classifiedRequirementSchema } from "../schemas/matching";

// ========== System Prompt ==========

const SYSTEM_PROMPT = `Je bent een recruitment-analyse assistent. Analyseer de opdrachtomschrijving en classificeer elke eis in een categorie.

Categorieën:
- KNOCKOUT: Harde eisen die absoluut vereist zijn (certificeringen, diploma's, minimale jaren ervaring, specifieke vergunningen). Kandidaat zonder deze eis wordt NIET voorgesteld. Binair: voldoet wel/niet.
- GUNNING: Zachte eisen en wensen die kwalitief beoordeeld worden (relevante ervaring, soft skills, branche-kennis, methodologieën). Gescoord op 1-5 sterren.
- PROCESS: Administratieve/procesvereisten (beschikbaarheidsdatum, VOG, geheimhoudingsverklaring, referenties). Worden genoteerd maar niet gescoord.

Regels:
- Extraheer ELKE afzonderlijke eis als apart criterium
- Combineer GEEN eisen — splits ze op
- Gebruik de letterlijke tekst uit de vacature als criterium
- Bij twijfel: markeer als GUNNING (niet als KNOCKOUT)
- Weight: 0-100 relatief belang binnen de tier. Verdeel gelijkmatig tenzij expliciet anders aangegeven
- Source: geef aan waar de eis vandaan komt: "requirements", "wishes", "competences", "description"`;

// ========== Output Schema ==========

const extractionOutputSchema = z.object({
  requirements: z.array(classifiedRequirementSchema),
});

// ========== Extract Requirements ==========

export async function extractRequirements(job: {
  title: string;
  description: string | null;
  requirements?: unknown;
  wishes?: unknown;
  competences?: unknown;
}): Promise<ClassifiedRequirement[]> {
  if (!job.description || job.description.length < 50) return [];

  const contextParts = [`Titel: ${job.title}`, `Omschrijving:\n${job.description}`];

  if (job.requirements && Array.isArray(job.requirements) && job.requirements.length > 0) {
    contextParts.push(`Eisen: ${JSON.stringify(job.requirements)}`);
  }
  if (job.wishes && Array.isArray(job.wishes) && job.wishes.length > 0) {
    contextParts.push(`Wensen: ${JSON.stringify(job.wishes)}`);
  }
  if (job.competences && Array.isArray(job.competences) && job.competences.length > 0) {
    contextParts.push(`Competenties: ${JSON.stringify(job.competences)}`);
  }

  const { output } = await withRetry(
    () =>
      generateText({
        model: google("gemini-3-flash-preview"),
        output: Output.object({ schema: extractionOutputSchema }),
        system: SYSTEM_PROMPT,
        prompt: contextParts.join("\n\n"),
        providerOptions: { google: { structuredOutputs: true } },
      }),
    { label: "Requirement Extraction" },
  );

  return (output as { requirements: ClassifiedRequirement[] }).requirements;
}
