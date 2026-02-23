import { z } from "zod";

// Shared between WS2 (CV parser output) and WS3 (skills graph input)
export const structuredSkillSchema = z.object({
  name: z.string().describe("Skill name"),
  proficiency: z.number().min(1).max(5).describe("1=beginner, 5=expert"),
  evidence: z.string().describe("How this was determined from the CV"),
});

export const structuredSkillsSchema = z.object({
  hard: z.array(structuredSkillSchema).describe("Technical/hard skills"),
  soft: z.array(structuredSkillSchema).describe("Soft/interpersonal skills"),
});

export const parsedCVSchema = z.object({
  // Personal information
  name: z.string().describe("Full name of the candidate"),
  email: z.string().email().nullable().describe("Email address"),
  phone: z.string().nullable().describe("Phone number"),
  dateOfBirth: z.string().nullable().describe("Date of birth in YYYY-MM-DD format"),
  nationality: z.string().nullable().describe("Nationality, e.g. Nederlands"),
  role: z.string().describe("Most recent or primary job title"),
  location: z.string().nullable().describe("City or region"),

  // Professional introduction
  introduction: z
    .string()
    .describe(
      "2-4 sentence professional introduction summarising the candidate's profile, expertise, and career highlights",
    ),

  // Structured skills
  skills: structuredSkillsSchema.describe("Structured skills breakdown"),

  // Work experience with period strings and responsibility lists
  experience: z
    .array(
      z.object({
        title: z.string().describe("Job title"),
        company: z.string().describe("Company or organisation name"),
        period: z.object({
          start: z.string().describe("Start date as YYYY-MM or YYYY, e.g. 2019-03"),
          end: z.string().describe("End date as YYYY-MM, YYYY, or 'heden' if current"),
        }),
        responsibilities: z
          .array(z.string())
          .describe("List of key responsibilities and achievements"),
      }),
    )
    .describe("Work experience entries, most recent first"),

  // Education with flexible year strings
  education: z
    .array(
      z.object({
        degree: z.string().describe("Degree, diploma, or qualification name"),
        institution: z.string().nullable().describe("Educational institution, null if not stated"),
        year: z.string().nullable().describe("Year or year range, e.g. '2012' or '2005-2006'"),
      }),
    )
    .describe("Formal education entries"),

  // Courses and short trainings (separate from certifications)
  courses: z.array(z.string()).describe("Short courses, trainings, and workshops attended"),

  // Formal certifications
  certifications: z
    .array(z.string())
    .describe("Professional certifications (VCA, BHV, PMP, Prince2, etc.)"),

  // Language proficiencies
  languages: z
    .array(
      z.object({
        language: z.string().describe("Language name"),
        level: z.string().describe("CEFR level (A1-C2), 'native', or 'moedertaal'"),
      }),
    )
    .describe("Language proficiencies"),

  // Derived / aggregated fields for matching pre-filtering
  totalYearsExperience: z
    .number()
    .nullable()
    .describe("Total years of professional experience, computed from work history"),
  highestEducationLevel: z
    .enum(["MBO", "HBO", "WO", "PhD"])
    .nullable()
    .describe("Highest completed education level classification"),
  industries: z
    .array(z.string())
    .describe(
      "Sectors/industries the candidate has worked in, e.g. Overheid, Bouw, IT, Finance, Zorg",
    ),
  preferredContractType: z
    .string()
    .nullable()
    .describe(
      "Preferred contract type if mentioned: freelance, interim, vast, detachering. Null if not stated",
    ),
  preferredWorkArrangement: z
    .string()
    .nullable()
    .describe(
      "Preferred work arrangement if mentioned: remote, hybride, op_locatie. Null if not stated",
    ),
});

// Export inferred types
export type StructuredSkill = z.infer<typeof structuredSkillSchema>;
export type StructuredSkills = z.infer<typeof structuredSkillsSchema>;
export type ParsedCV = z.infer<typeof parsedCVSchema>;
