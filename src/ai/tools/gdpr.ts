import { tool } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { publish } from "@/src/lib/event-bus";
import {
  eraseCandidateData,
  exportCandidateData,
  exportContactData,
  scrubContactData,
} from "@/src/services/gdpr";

export const exporteerKandidaatData = tool({
  description:
    "Exporteer alle data van een kandidaat (GDPR Art. 15 — recht op inzage). Retourneert alle kandidaatgegevens, sollicitaties, interviews, berichten en matches.",
  inputSchema: z.object({
    candidateId: z.string().uuid().describe("UUID van de kandidaat"),
  }),
  execute: async ({ candidateId }) => {
    const data = await exportCandidateData(candidateId, "ai-agent");
    if (!data) return { error: "Kandidaat niet gevonden" };
    return data;
  },
});

export const wisKandidaatData = tool({
  description:
    "Verwijder alle data van een kandidaat permanent (GDPR Art. 17 — recht op vergetelheid). Dit kan NIET ongedaan worden gemaakt. Verwijdert: berichten, interviews, sollicitaties, matches en de kandidaat zelf.",
  inputSchema: z.object({
    candidateId: z.string().uuid().describe("UUID van de kandidaat"),
    bevestig: z.boolean().describe("Bevestig dat je alle data permanent wilt verwijderen"),
  }),
  execute: async ({ candidateId, bevestig }) => {
    if (bevestig !== true) {
      return { error: "Bevestiging is vereist om data permanent te verwijderen" };
    }
    const result = await eraseCandidateData(candidateId, "ai-agent");
    revalidatePath("/kandidaten");
    revalidatePath("/vacatures");
    revalidatePath("/overzicht");
    revalidatePath("/pipeline");
    revalidatePath("/messages");
    publish("candidate:erased", { candidateId });
    return result;
  },
});

export const scrubContactGegevens = tool({
  description:
    "Verwijder contact PII (naam/email) uit vacatures die matchen op een identifier. Zoekt in agent en recruiter contactvelden.",
  inputSchema: z.object({
    identifier: z.string().describe("E-mailadres of naam om te scrubben"),
  }),
  execute: async ({ identifier }) => {
    const result = await scrubContactData(identifier, "ai-agent");
    if (result.scrubbed > 0) {
      revalidatePath("/vacatures");
      publish("contact:scrubbed", { identifier, scrubbed: result.scrubbed });
    }
    return result;
  },
});

export const exporteerContactData = tool({
  description:
    "Exporteer contactdata (agent/recruiter) voor vacatures die matchen op een identifier (GDPR inzage voor contactpersonen).",
  inputSchema: z.object({
    identifier: z.string().describe("E-mailadres of naam om te zoeken"),
  }),
  execute: async ({ identifier }) => {
    const result = await exportContactData(identifier, "ai-agent");
    return result;
  },
});
