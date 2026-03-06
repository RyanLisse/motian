import { z } from "zod";

/** POST /api/kandidaten/[id]/koppel — confirm selected matches and create applications */
export const koppelBodySchema = z.object({
  matchIds: z.array(z.string().uuid()).optional(),
  jobIds: z.array(z.string().uuid()).optional(),
}).refine((data) => (data.matchIds?.length ?? 0) > 0 || (data.jobIds?.length ?? 0) > 0, {
  message: "matchIds of jobIds verplicht (minimaal één item)",
});
export type KoppelBody = z.infer<typeof koppelBodySchema>;
