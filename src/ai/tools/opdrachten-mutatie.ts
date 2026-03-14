import { tool } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { publish } from "@/src/lib/event-bus";
import { deleteJob, updateJob } from "@/src/services/jobs";

export const updateOpdracht = tool({
  description:
    "Werk een bestaande vacature bij. Geef het ID en minimaal één veld dat gewijzigd moet worden.",
  inputSchema: z
    .object({
      id: z.string().uuid().describe("UUID van de vacature"),
      title: z.string().optional().describe("Nieuwe titel van de vacature"),
      description: z.string().optional().describe("Nieuwe omschrijving van de vacature"),
      location: z.string().optional().describe("Nieuwe locatie, bijv. Amsterdam, Utrecht"),
      rateMin: z.number().optional().describe("Minimum uurtarief in EUR"),
      rateMax: z.number().optional().describe("Maximum uurtarief in EUR"),
      contractType: z
        .string()
        .optional()
        .describe("Contracttype: freelance, interim, vast, opdracht"),
      workArrangement: z.string().optional().describe("Werklocatie: remote, hybrid, on-site"),
    })
    .refine(({ id: _id, ...rest }) => Object.values(rest).some((v) => v !== undefined), {
      message: "Minimaal één veld om bij te werken is vereist",
    }),
  execute: async ({ id, ...data }) => {
    const job = await updateJob(id, data);
    if (!job) return { error: "Vacature niet gevonden" };
    revalidatePath("/opdrachten");
    revalidatePath(`/opdrachten/${id}`);
    publish("job:updated", { id });
    return job;
  },
});

export const verwijderOpdracht = tool({
  description: "Archiveer een vacature zonder deze uit de database te verwijderen.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de vacature die gearchiveerd moet worden"),
  }),
  execute: async ({ id }) => {
    const success = await deleteJob(id);
    if (!success) return { error: "Vacature niet gevonden of kon niet worden gearchiveerd" };
    revalidatePath("/opdrachten");
    publish("job:deleted", { id });
    return { success: true, message: "Vacature succesvol gearchiveerd" };
  },
});
