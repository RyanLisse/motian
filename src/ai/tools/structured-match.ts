import { tool } from "ai";
import { z } from "zod";
import { getCandidateById } from "@/src/services/candidates";
import { getJobById } from "@/src/services/jobs";
import { extractRequirements } from "@/src/services/requirement-extraction";
import { runStructuredMatch } from "@/src/services/structured-matching";

export const voerStructuredMatchUit = tool({
  description:
    "Voer een diepgaande gestructureerde matching uit (Mariënne-methodologie). Evalueert een kandidaat tegen alle eisen van een vacature met knock-out criteria, gunningscriteria en een eindbeoordeling.",
  inputSchema: z.object({
    jobId: z.string().uuid().describe("UUID van de vacature"),
    candidateId: z.string().uuid().describe("UUID van de kandidaat"),
  }),
  execute: async ({ jobId, candidateId }) => {
    try {
      const [job, candidate] = await Promise.all([
        getJobById(jobId),
        getCandidateById(candidateId),
      ]);

      if (!job) {
        return { error: `Vacature niet gevonden (id: ${jobId})` };
      }
      if (!candidate) {
        return { error: `Kandidaat niet gevonden (id: ${candidateId})` };
      }

      if (!job.description || job.description.length < 50) {
        return {
          error:
            "Vacatureomschrijving is te kort of ontbreekt. Minimaal 50 tekens vereist voor een gestructureerde matching.",
        };
      }

      if (!candidate.resumeRaw) {
        return {
          error: `Kandidaat "${candidate.name}" heeft geen CV-tekst. Upload eerst een CV voordat je een gestructureerde matching uitvoert.`,
        };
      }

      const requirements = await extractRequirements({
        title: job.title,
        description: job.description,
        requirements: job.requirements as unknown[] | undefined,
        wishes: job.wishes as unknown[] | undefined,
        competences: job.competences as unknown[] | undefined,
      });

      if (requirements.length === 0) {
        return {
          error:
            "Kon geen eisen extraheren uit de vacatureomschrijving. Controleer of de omschrijving voldoende detail bevat.",
        };
      }

      const result = await runStructuredMatch({
        requirements,
        candidateName: candidate.name,
        cvText: candidate.resumeRaw,
      });

      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Onbekende fout bij gestructureerde matching";
      return { error: message };
    }
  },
});
