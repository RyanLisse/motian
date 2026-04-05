import { z } from "zod";
import { gemini31FlashLite, tracedGenerateObject as generateObject } from "../lib/ai-models";
import { getCandidateById } from "./candidates";
import { getJobById } from "./jobs";
import { getMatchById } from "./matches";
import { generateScreeningQuestions } from "./screening-calls";

const SYSTEM_PROMPT = `Je bent een recruiter-copilot voor Motian en maakt interviewvoorbereiding voor vacatures, kandidaten en matches.

Regels:
- Schrijf alles in helder Nederlands.
- Gebruik AI alleen voor interviewvoorbereiding, samenvatting en aanbevelingen.
- Laat AI nooit de definitieve hiring-beslissing nemen.
- Maak scorecriteria concreet en observeerbaar.
- Zorg dat de output bruikbaar is voor recruiter-notes of latere writeback in Motian.`;

export const interviewPrepGeneratorInputSchema = z.object({
  request: z.string().min(1).describe("Korte omschrijving van het gewenste interviewprep pakket"),
  jobId: z.string().uuid().optional(),
  candidateId: z.string().uuid().optional(),
  matchId: z.string().uuid().optional(),
  jobSummary: z.string().optional(),
  candidateSummary: z.string().optional(),
  interviewType: z
    .string()
    .optional()
    .describe("Bijv. screening, intake, klantinterview, technical"),
  interviewGoal: z
    .string()
    .optional()
    .describe("Wat moet het gesprek vooral uitwijzen of opleveren"),
  focusAreas: z.array(z.string()).optional().describe("Belangrijkste thema's of risico's"),
  answersSummary: z
    .string()
    .optional()
    .describe("Samenvatting van verduidelijkende antwoorden uit het gesprek"),
  constraints: z.string().optional(),
});

const scorecardCriterionSchema = z.object({
  criterion: z.string(),
  whatGoodLooksLike: z.string(),
  redFlag: z.string(),
});

const readyArtifactSchema = z.object({
  prepSummary: z.object({
    interviewType: z.string(),
    interviewGoal: z.string(),
    recommendedDuration: z.string(),
    contextSummary: z.string(),
  }),
  openingPrompt: z.string(),
  mustAskQuestions: z.array(z.string()).min(4).max(8),
  scorecardCriteria: z.array(scorecardCriterionSchema).min(3).max(6),
  evidenceToCapture: z.array(z.string()).min(3).max(6),
  recruiterNotes: z.array(z.string()).min(3).max(6),
  humanGuardrails: z.array(z.string()).min(3).max(6),
  writebackPayload: z.object({
    type: z.literal("interview_prep_template"),
    interviewType: z.string(),
    linkedJobId: z.string().nullable(),
    linkedCandidateId: z.string().nullable(),
    linkedMatchId: z.string().nullable(),
    mustAskQuestions: z.array(z.string()),
    evidenceToCapture: z.array(z.string()),
  }),
});

export const interviewPrepGeneratorOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("needs_clarification"),
    missingInformation: z.array(z.string()).min(1),
    recommendedQuestions: z.array(z.string()).min(3).max(5),
    nextStep: z.string(),
  }),
  z.object({
    status: z.literal("ready"),
    artifact: readyArtifactSchema,
  }),
]);

export type InterviewPrepGeneratorInput = z.infer<typeof interviewPrepGeneratorInputSchema>;
export type InterviewPrepGeneratorOutput = z.infer<typeof interviewPrepGeneratorOutputSchema>;

const DETAIL_LABELS: Record<string, string> = {
  context: "vacature-, kandidaat- of matchcontext",
  interviewType: "interviewtype",
  interviewGoal: "gespreksdoel",
  focusAreas: "belangrijkste focusgebieden of risico's",
};

const DETAIL_QUESTIONS: Record<string, string> = {
  context:
    "Gaat dit interview over een specifieke vacature, kandidaat of match, en welke context moet ik meenemen?",
  interviewType:
    "Welk type gesprek is dit precies: screening, intake, klantinterview of technisch interview?",
  interviewGoal:
    "Wat moet dit gesprek vooral uitwijzen: motivatie, ervaring, skill-fit, tarief, beschikbaarheid of iets anders?",
  focusAreas: "Welke risico's, competenties of thema's wil je expliciet toetsen in dit gesprek?",
};

function compactText(value?: string | null) {
  return value?.trim() ?? "";
}

function cleanList(values?: string[]) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function collectMissingDetails(input: InterviewPrepGeneratorInput) {
  const missing: string[] = [];
  const hasStructuredContext =
    Boolean(input.jobId) ||
    Boolean(input.candidateId) ||
    Boolean(input.matchId) ||
    Boolean(compactText(input.jobSummary)) ||
    Boolean(compactText(input.candidateSummary));

  if (!hasStructuredContext) missing.push("context");
  if (!compactText(input.interviewType)) missing.push("interviewType");
  if (!compactText(input.interviewGoal)) missing.push("interviewGoal");
  if (cleanList(input.focusAreas).length === 0 && !compactText(input.answersSummary)) {
    missing.push("focusAreas");
  }

  return missing;
}

function buildClarificationResponse(
  missing: string[],
): Extract<InterviewPrepGeneratorOutput, { status: "needs_clarification" }> {
  const recommendedQuestions = missing
    .slice(0, 5)
    .map((key) => DETAIL_QUESTIONS[key] ?? key)
    .filter(Boolean);

  return {
    status: "needs_clarification",
    missingInformation: missing.map((key) => DETAIL_LABELS[key] ?? key),
    recommendedQuestions:
      recommendedQuestions.length >= 3
        ? recommendedQuestions
        : [
            DETAIL_QUESTIONS.context,
            DETAIL_QUESTIONS.interviewType,
            DETAIL_QUESTIONS.interviewGoal,
          ],
    nextStep:
      "Vraag eerst 3-5 verduidelijkende vragen, vat de antwoorden kort samen en genereer daarna pas de interviewvoorbereiding.",
  };
}

function summarizeContext(params: {
  jobSummary?: string;
  candidateSummary?: string;
  answersSummary?: string;
  focusAreas: string[];
}) {
  return [
    params.jobSummary ? `Vacaturecontext: ${params.jobSummary}` : null,
    params.candidateSummary ? `Kandidaatcontext: ${params.candidateSummary}` : null,
    params.answersSummary ? `Samenvatting: ${params.answersSummary}` : null,
    params.focusAreas.length > 0 ? `Focusgebieden: ${params.focusAreas.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateInterviewPrep(
  input: InterviewPrepGeneratorInput,
): Promise<InterviewPrepGeneratorOutput> {
  const parsed = interviewPrepGeneratorInputSchema.parse(input);
  const missing = collectMissingDetails(parsed);

  if (missing.length > 0) {
    return buildClarificationResponse(missing);
  }

  const [job, candidate, match] = await Promise.all([
    parsed.jobId ? getJobById(parsed.jobId) : Promise.resolve(null),
    parsed.candidateId ? getCandidateById(parsed.candidateId) : Promise.resolve(null),
    parsed.matchId ? getMatchById(parsed.matchId) : Promise.resolve(null),
  ]);

  const derivedJob = job ?? (match?.jobId ? await getJobById(match.jobId) : null);
  const derivedCandidate =
    candidate ?? (match?.candidateId ? await getCandidateById(match.candidateId) : null);

  const screeningQuestions =
    derivedCandidate || derivedJob || match
      ? await generateScreeningQuestions(
          (derivedCandidate ?? {}) as Record<string, unknown>,
          (derivedJob ?? {}) as Record<string, unknown>,
          (match ?? {}) as Record<string, unknown>,
        )
      : [];

  const focusAreas = cleanList(parsed.focusAreas);
  const contextSummary = summarizeContext({
    jobSummary:
      compactText(parsed.jobSummary) ||
      (derivedJob
        ? `${derivedJob.title}${derivedJob.company ? ` bij ${derivedJob.company}` : ""}${derivedJob.location ? ` in ${derivedJob.location}` : ""}`
        : ""),
    candidateSummary:
      compactText(parsed.candidateSummary) ||
      (derivedCandidate
        ? `${derivedCandidate.name}${derivedCandidate.role ? `, ${derivedCandidate.role}` : ""}${derivedCandidate.location ? ` uit ${derivedCandidate.location}` : ""}`
        : ""),
    answersSummary: compactText(parsed.answersSummary),
    focusAreas,
  });

  const seedQuestions = screeningQuestions.map((question) => question.question).slice(0, 5);

  const result = await generateObject({
    model: gemini31FlashLite,
    schema: readyArtifactSchema,
    system: SYSTEM_PROMPT,
    prompt: `Maak een recruiter-ready interviewvoorbereiding voor Motian.

Verzoek:
${parsed.request}

Interviewtype: ${compactText(parsed.interviewType)}
Gespreksdoel: ${compactText(parsed.interviewGoal)}
Constraints: ${compactText(parsed.constraints) || "geen extra constraints"}

Context:
${contextSummary || "Geen extra context"}

Bestaande screeningvragen uit Motian:
${seedQuestions.length > 0 ? seedQuestions.map((question) => `- ${question}`).join("\n") : "- geen"}

Vereisten:
1. Gebruik de context om het gesprek concreet te maken.
2. Neem bestaande screeningvragen mee waar relevant, maar maak er een sterker interviewprep pakket van.
3. Maak scorecriteria observeerbaar en praktisch voor recruiters.
4. Neem expliciete human guardrails op: AI beslist nooit over hiring of eindbeoordeling.
5. Maak een writebackPayload dat later in Motian-notes of interviewlogging gebruikt kan worden.`,
    providerOptions: {
      google: {
        structuredOutputs: true,
      },
    },
  });

  return {
    status: "ready",
    artifact: {
      ...result.object,
      writebackPayload: {
        ...result.object.writebackPayload,
        linkedJobId: derivedJob?.id ?? parsed.jobId ?? null,
        linkedCandidateId: derivedCandidate?.id ?? parsed.candidateId ?? null,
        linkedMatchId: match?.id ?? parsed.matchId ?? null,
      },
    },
  };
}
