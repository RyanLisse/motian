import { tool } from "ai";
import { z } from "zod";
import {
  createInterview,
  deleteInterview,
  getInterviewById,
  getUpcomingInterviews,
  listInterviews,
  updateInterview,
} from "@/src/services/interviews";

const VALID_STATUSES = ["scheduled", "completed", "cancelled"] as const;
const VALID_TYPES = ["phone", "video", "onsite", "technical"] as const;

export const zoekInterviews = tool({
  description:
    "Zoek en filter interviews (sollicitatiegesprekken). Filter op sollicitatie-ID, status, of toon alleen aankomende interviews.",
  inputSchema: z.object({
    applicationId: z
      .string()
      .uuid()
      .optional()
      .describe("UUID van de sollicitatie om interviews voor op te halen"),
    status: z
      .enum(VALID_STATUSES)
      .optional()
      .describe("Status filter: scheduled, completed, cancelled"),
    upcomingOnly: z
      .boolean()
      .optional()
      .default(false)
      .describe("Alleen aankomende interviews tonen"),
    limit: z.number().optional().default(20).describe("Max resultaten (standaard 20)"),
  }),
  execute: async ({ applicationId, status, upcomingOnly, limit }) => {
    if (upcomingOnly) {
      const interviews = await getUpcomingInterviews();
      return { total: interviews.length, interviews };
    }

    const interviews = await listInterviews({ applicationId, status, limit });
    return { total: interviews.length, interviews };
  },
});

export const getInterviewDetail = tool({
  description:
    "Haal volledige details op van één interview op basis van ID. Gebruik dit wanneer de gebruiker meer wil weten over een specifiek sollicitatiegesprek.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van het interview"),
  }),
  execute: async ({ id }) => {
    const interview = await getInterviewById(id);
    if (!interview) return { error: "Interview niet gevonden" };
    return interview;
  },
});

export const planInterview = tool({
  description:
    "Plan een nieuw sollicitatiegesprek in. Geef de sollicitatie-ID, datum/tijd, type gesprek en interviewer op.",
  inputSchema: z.object({
    applicationId: z.string().uuid().describe("UUID van de sollicitatie"),
    scheduledAt: z
      .string()
      .datetime({ offset: true })
      .describe("Geplande datum en tijd in ISO 8601 formaat, bijv. 2026-03-01T14:00:00Z"),
    type: z.enum(VALID_TYPES).describe("Type gesprek: phone, video, onsite, technical"),
    interviewer: z.string().describe("Naam van de interviewer"),
    duration: z.number().optional().describe("Duur van het gesprek in minuten"),
    location: z.string().optional().describe("Locatie of videolink voor het gesprek"),
  }),
  execute: async ({ applicationId, scheduledAt, type, interviewer, duration, location }) => {
    const interview = await createInterview({
      applicationId,
      scheduledAt: new Date(scheduledAt),
      type,
      interviewer,
      duration,
      location,
    });
    return interview;
  },
});

export const updateInterviewTool = tool({
  description: "Werk een bestaand interview bij. Pas status, feedback of beoordeling aan.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van het interview"),
    status: z
      .enum(VALID_STATUSES)
      .optional()
      .describe("Nieuwe status: scheduled, completed, cancelled"),
    feedback: z.string().optional().describe("Feedback of notities over het gesprek"),
    rating: z.number().min(1).max(5).optional().describe("Beoordeling van de kandidaat (1-5)"),
  }),
  execute: async ({ id, status, feedback, rating }) => {
    const result = await updateInterview(id, { status, feedback, rating });
    if (result.emptyUpdate) return { error: "Geen velden opgegeven om bij te werken" };
    if (!result.interview) return { error: "Interview niet gevonden of ongeldige waarden" };
    return result.interview;
  },
});

export const verwijderInterview = tool({
  description: "Verwijder een interview op basis van ID. Dit kan niet ongedaan worden gemaakt.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van het interview om te verwijderen"),
  }),
  execute: async ({ id }) => {
    const deleted = await deleteInterview(id);
    if (!deleted) return { error: "Interview niet gevonden of kon niet verwijderd worden" };
    return { success: true, message: "Interview succesvol verwijderd" };
  },
});
