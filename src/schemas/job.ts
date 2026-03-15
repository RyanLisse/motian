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
  endClient: z.string().optional(),
  contractLabel: z.string().optional(),
  location: z.string().optional(),
  province: z.string().optional(),
  description: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(10, "Beschrijving moet minimaal 10 tekens bevatten").optional(),
  ),
  status: z.enum(["open", "closed", "archived"]).default("open"),

  // === Tarieven & Posities ===
  rateMin: z.preprocess(
    (v) => (v === undefined || v === null ? undefined : Number(v)),
    z.number().min(0).optional(),
  ),
  rateMax: z.preprocess(
    (v) => (v === undefined || v === null ? undefined : Number(v)),
    z.number().min(0).optional(),
  ),
  currency: z.string().default("EUR"),
  positionsAvailable: z.preprocess(
    (v) => (typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? Math.round(v) : v),
    z.number().int().positive().default(1),
  ),

  // === Data & Deadlines ===
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  applicationDeadline: z.coerce.date().optional(),
  postedAt: z.coerce.date().optional(),

  // === Werkcondities ===
  contractType: z.enum(["freelance", "interim", "vast", "opdracht"]).optional(),
  workArrangement: z.enum(["remote", "hybride", "op_locatie"]).optional(),
  allowsSubcontracting: z.boolean().optional(),

  // === Gestructureerde Eisen ===
  requirements: z.array(z.union([z.string(), requirementSchema])).default([]),
  wishes: z.array(z.union([z.string(), wishSchema])).default([]),
  competences: z.array(z.string()).default([]),
  conditions: z.array(z.string()).default([]),

  // === Verrijkte Data ===
  hoursPerWeek: z.preprocess((v) => {
    if (v == null) return undefined;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.min(168, Math.max(1, Math.round(n)));
  }, z.number().int().positive().max(168).optional()),
  minHoursPerWeek: z.preprocess((v) => {
    if (v == null) return undefined;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.min(168, Math.max(1, Math.round(n)));
  }, z.number().int().positive().max(168).optional()),
  extensionPossible: z.boolean().optional(),
  countryCode: z.string().optional(),
  remunerationType: z.string().optional(),
  workExperienceYears: z.preprocess(
    (v) => (v === undefined || v === null ? undefined : Math.round(Number(v))),
    z.number().int().min(0).optional(),
  ),
  numberOfViews: z.preprocess(
    (v) => (v === undefined || v === null ? undefined : Math.round(Number(v))),
    z.number().int().min(0).optional(),
  ),
  attachments: z
    .array(
      z.object({
        url: z.string(),
        description: z.string().optional().default(""),
      }),
    )
    .default([]),
  questions: z
    .array(
      z.object({
        question: z.string(),
        type: z.string().optional().default(""),
        options: z.array(z.unknown()).default([]),
      }),
    )
    .default([]),
  languages: z.array(z.string()).default([]),
  descriptionSummary: z
    .union([z.object({ nl: z.string().optional(), en: z.string().optional() }), z.string()])
    .optional(),
  faqAnswers: z
    .array(
      z.object({
        category: z.string().optional().default(""),
        question: z.string().optional().default(""),
        answer: z.string().optional().default(""),
      }),
    )
    .default([]),
  agentContact: z
    .object({
      name: z.string().optional().default(""),
      email: z.string().optional().default(""),
      phone: z.string().optional().default(""),
    })
    .optional(),
  recruiterContact: z
    .object({
      name: z.string().optional().default(""),
      email: z.string().optional().default(""),
      phone: z.string().optional().default(""),
    })
    .optional(),

  // === Locatie & Organisatie ===
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  postcode: z.string().optional(),
  companyLogoUrl: z.string().optional(),

  // === Opdracht Kenmerken ===
  educationLevel: z.string().optional(),
  durationMonths: z.preprocess((v) => {
    if (v === undefined || v === null) return undefined;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, z.number().int().positive().optional()),
  sourceUrl: z.string().optional(),
  sourcePlatform: z.string().optional(),
  categories: z.array(z.string()).default([]),
  companyAddress: z.string().optional(),
});

export type UnifiedJob = z.infer<typeof unifiedJobSchema>;

// Helper: extract province uit "City - Province" format
export function extractProvince(location: string): string | undefined {
  const parts = location.split(" - ");
  return parts.length > 1 ? parts[1].trim() : undefined;
}
