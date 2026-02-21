import { z } from "zod";

// Gestructureerde eis (Striive "Eisen" met knockout vlag)
const requirementSchema = z.object({
  description: z.string(),
  isKnockout: z.boolean().default(false),
});

// Gestructureerde wens (Striive "Wensen" met evaluatie criteria)
const wishSchema = z.object({
  description: z.string(),
  evaluationCriteria: z.string().optional(),
});

export const unifiedJobSchema = z.object({
  // === Identificatie ===
  externalId: z.string().min(1),
  externalUrl: z.string().url(),
  clientReferenceCode: z.string().optional(),

  // === Kern ===
  title: z.string().min(1, "Titel is verplicht"),
  company: z.string().optional(),
  contractLabel: z.string().optional(),
  location: z.string().optional(),
  province: z.string().optional(),
  description: z.string().min(10),

  // === Tarieven & Posities ===
  rateMin: z.number().positive().optional(),
  rateMax: z.number().positive().optional(),
  currency: z.string().default("EUR"),
  positionsAvailable: z.number().int().positive().default(1),

  // === Data & Deadlines ===
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  applicationDeadline: z.coerce.date().optional(),
  postedAt: z.coerce.date().optional(),

  // === Werkcondities ===
  contractType: z
    .enum(["freelance", "interim", "vast", "opdracht"])
    .optional(),
  workArrangement: z
    .enum(["remote", "hybride", "op_locatie"])
    .optional(),
  allowsSubcontracting: z.boolean().optional(),

  // === Gestructureerde Eisen ===
  requirements: z
    .array(z.union([z.string(), requirementSchema]))
    .default([]),
  wishes: z.array(z.union([z.string(), wishSchema])).default([]),
  competences: z.array(z.string()).default([]),
  conditions: z.array(z.string()).default([]),
});

export type UnifiedJob = z.infer<typeof unifiedJobSchema>;

// Helper: extract province uit "City - Province" format
export function extractProvince(location: string): string | undefined {
  const parts = location.split(" - ");
  return parts.length > 1 ? parts[1].trim() : undefined;
}
