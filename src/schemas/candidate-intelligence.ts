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
  name: z.string().describe("Full name of the candidate"),
  email: z.string().email().nullable().describe("Email address"),
  phone: z.string().nullable().describe("Phone number"),
  role: z.string().describe("Most recent or primary job title"),
  location: z.string().nullable().describe("City or region"),
  skills: structuredSkillsSchema.describe("Structured skills breakdown"),
  experience: z
    .array(
      z.object({
        title: z.string().describe("Job title"),
        company: z.string().describe("Company name"),
        startYear: z.number().nullable().describe("Start year of employment"),
        endYear: z.number().nullable().describe("End year of employment, null if current"),
        description: z.string().describe("Role description and achievements"),
      }),
    )
    .describe("Work experience entries"),
  education: z
    .array(
      z.object({
        degree: z.string().describe("Degree or qualification"),
        institution: z.string().describe("Educational institution"),
        year: z.number().nullable().describe("Graduation year"),
      }),
    )
    .describe("Education entries"),
  certifications: z.array(z.string()).describe("Professional certifications"),
  languages: z
    .array(
      z.object({
        language: z.string().describe("Language name"),
        level: z.string().describe("CEFR level: A1-C2 or native"),
      }),
    )
    .describe("Language proficiencies"),
  summary: z.string().describe("2-3 sentence professional summary"),
});

// Export inferred types
export type StructuredSkill = z.infer<typeof structuredSkillSchema>;
export type StructuredSkills = z.infer<typeof structuredSkillsSchema>;
export type ParsedCV = z.infer<typeof parsedCVSchema>;
