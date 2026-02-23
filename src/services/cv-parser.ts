import { generateText, Output } from "ai";
import mammoth from "mammoth";
import { geminiFlash } from "../lib/ai-models";
import { withRetry } from "../lib/retry";
import { type ParsedCV, parsedCVSchema } from "../schemas/candidate-intelligence";

const SYSTEM_PROMPT = `Je bent een CV-parser voor een Nederlands recruitment platform. Analyseer dit CV en extraheer ALLE relevante informatie zo volledig mogelijk.

PERSOONLIJKE GEGEVENS:
- Naam, email, telefoon, geboortedatum (YYYY-MM-DD), nationaliteit, woonplaats
- Als gegevens niet vermeld zijn, gebruik null

INTRODUCTIE:
- Schrijf een professionele samenvatting van 2-4 zinnen over de kandidaat
- Beschrijf expertise, werkervaring, en specialisaties

VAARDIGHEDEN:
- Schat het vaardigheidsniveau in (1=beginner, 5=expert) op basis van jaren ervaring, projecten, en certificeringen
- Onderscheid harde vaardigheden (technisch, tools, methodologieën) en zachte vaardigheden (communicatie, leiderschap, samenwerking)
- Geef bij evidence de specifieke tekst uit het CV die het niveau rechtvaardigt

WERKERVARING:
- Lijst ALLE werkposities chronologisch (meest recent eerst)
- Gebruik period.start en period.end als strings: "YYYY-MM" of "YYYY" formaat
- Gebruik "heden" als de positie nog actueel is
- Lijst alle verantwoordelijkheden en taken als aparte strings in responsibilities[]
- Als geen taken beschreven zijn, gebruik een lege array []

OPLEIDING:
- Lijst alle formele opleidingen (MBO, HBO, WO, universiteit)
- year als string: "2012" of "2005-2006" voor periodes
- institution mag null zijn als niet vermeld

CURSUSSEN:
- Lijst alle korte cursussen, trainingen, en workshops apart van opleidingen
- Bijv. "VCA VOL", "BHV", "Cursus Brandveiligheid", "LEAN methodiek"

CERTIFICERINGEN:
- Lijst formele certificeringen apart: "AWS Solutions Architect", "Prince2 Practitioner", "PMP"
- Onderscheid van cursussen: certificeringen zijn formele kwalificaties met erkenning

TALEN:
- Gebruik CEFR-niveaus (A1, A2, B1, B2, C1, C2), "native", of "moedertaal"
- Als niveau niet expliciet vermeld, schat in op basis van context

AFGELEIDE VELDEN (voor matching met vacatures):
- totalYearsExperience: bereken het totale aantal jaren werkervaring op basis van de periodes. Rond af op geheel getal. Null als niet te bepalen.
- highestEducationLevel: classificeer het hoogst behaalde opleidingsniveau als "MBO", "HBO", "WO", of "PhD". Gebruik null als niet te bepalen. Let op: "Propedeuse HBO" = MBO niveau (niet afgerond). "M.T.S." = MBO. "Universiteit" / "MSc" / "Master" = WO.
- industries: lijst van sectoren/branches waar de kandidaat heeft gewerkt. Bijv: "Overheid", "Bouw", "IT", "Finance", "Zorg", "Vastgoed", "Retail", "Energie", "Transport".
- preferredContractType: als het CV een voorkeur vermeldt (freelance, interim, ZZP, vast, detachering), gebruik die. Anders null.
- preferredWorkArrangement: als het CV een voorkeur vermeldt (remote, hybride, op locatie), gebruik die. Anders null.

Wees nauwkeurig en volledig. Extraheer ALLES uit het CV. Als informatie ontbreekt, gebruik null.`;

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
    const { output } = await withRetry(
      () =>
        generateText({
          model: geminiFlash,
          output: Output.object({ schema: parsedCVSchema }),
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

    return output as ParsedCV;
  }

  // Word document: extract text first, then send as plain text
  const text = await extractWordText(fileBuffer);

  const { output } = await withRetry(
    () =>
      generateText({
        model: geminiFlash,
        output: Output.object({ schema: parsedCVSchema }),
        system: SYSTEM_PROMPT,
        prompt: `Analyseer dit CV en extraheer alle informatie.\n\n${text}`,
        providerOptions: { google: { structuredOutputs: true } },
      }),
    { label: "CV Parser (Word)" },
  );

  return output as ParsedCV;
}
