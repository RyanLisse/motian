import { z } from "zod";

/** Payload for creating a new saved search filter. */
export const createSavedSearchSchema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  filters: z.record(z.unknown()).refine((val) => Object.keys(val).length > 0, {
    message: "Filters mag niet leeg zijn",
  }),
});

export type CreateSavedSearchPayload = z.infer<typeof createSavedSearchSchema>;
