import { db, desc, eq } from "../db";
import { candidates, jobMatches, jobs, screeningCalls } from "../db/schema";

// ---------- Types ----------
export interface ScreeningQuestion {
  id: string;
  question: string;
  category: "ai_generated" | "template" | "custom";
  priority: number;
  answer?: string;
  sentiment?: "positive" | "neutral" | "negative";
}

export interface CreateScreeningCallInput {
  candidateId: string;
  jobId?: string;
  matchId?: string;
  applicationId?: string;
  initiatedBy?: "recruiter" | "ai_agent";
}

// ---------- Template questions (Dutch) ----------
const TEMPLATE_QUESTIONS: Omit<ScreeningQuestion, "id">[] = [
  {
    question: "Wat is uw huidige beschikbaarheid en wanneer kunt u starten?",
    category: "template",
    priority: 1,
  },
  {
    question: "Wat is uw gewenste uurtarief of salarisrange?",
    category: "template",
    priority: 2,
  },
  {
    question: "Waarom bent u geïnteresseerd in deze functie?",
    category: "template",
    priority: 3,
  },
  {
    question:
      "Werkt u momenteel aan andere opdrachten of bent u in gesprek bij andere opdrachtgevers?",
    category: "template",
    priority: 4,
  },
  {
    question: "Bent u bereid om op locatie te werken, of heeft u een voorkeur voor remote/hybride?",
    category: "template",
    priority: 5,
  },
];

// ---------- AI question generation ----------
export async function generateScreeningQuestions(
  candidateData: Record<string, unknown>,
  jobData: Record<string, unknown>,
  matchData: Record<string, unknown>,
): Promise<ScreeningQuestion[]> {
  const aiQuestions: ScreeningQuestion[] = [];

  // Generate contextual questions from match gaps and job requirements
  const requirements = (jobData.requirements as string[]) ?? [];
  const skills = (candidateData.skills as string[]) ?? [];
  const matchScore = (matchData.matchScore as number) ?? 0;
  const riskProfile = (matchData.riskProfile as Record<string, unknown>) ?? {};

  // Question about skill gaps
  const missingSkills = requirements.filter(
    (req) =>
      !skills.some(
        (s) => typeof s === "string" && s.toLowerCase().includes(String(req).toLowerCase()),
      ),
  );
  if (missingSkills.length > 0) {
    aiQuestions.push({
      id: crypto.randomUUID(),
      question: `In de functie-eisen worden ${missingSkills
        .slice(0, 3)
        .join(", ")} genoemd. Kunt u uw ervaring met deze vaardigheden toelichten?`,
      category: "ai_generated",
      priority: 0,
    });
  }

  // Question about location if mismatch
  const jobLocation = jobData.location as string;
  const candidateLocation = candidateData.location as string;
  if (
    jobLocation &&
    candidateLocation &&
    !jobLocation.toLowerCase().includes(candidateLocation.toLowerCase())
  ) {
    aiQuestions.push({
      id: crypto.randomUUID(),
      question: `De opdracht is gevestigd in ${jobLocation}. U bent momenteel in ${candidateLocation}. Is reizen of verhuizen een optie voor u?`,
      category: "ai_generated",
      priority: 1,
    });
  }

  // Question about rate if known
  const jobRateMax = jobData.rateMax as number | undefined;
  const candidateRate = candidateData.hourlyRate as number | undefined;
  if (jobRateMax && candidateRate && candidateRate > jobRateMax) {
    aiQuestions.push({
      id: crypto.randomUUID(),
      question: `Het maximale tarief voor deze opdracht is €${jobRateMax}/uur. Uw gewenste tarief ligt hoger. Is er ruimte voor onderhandeling?`,
      category: "ai_generated",
      priority: 1,
    });
  }

  // Question about experience depth if moderate match
  if (matchScore < 75 && matchScore >= 50) {
    aiQuestions.push({
      id: crypto.randomUUID(),
      question:
        "Kunt u een recent project beschrijven dat het meest aansluit bij deze opdracht? Wat was uw exacte rol en wat heeft u opgeleverd?",
      category: "ai_generated",
      priority: 2,
    });
  }

  // Risk-based questions
  const risks = (riskProfile as { risks?: Array<{ label: string }> })?.risks ?? [];
  for (const risk of risks.slice(0, 2)) {
    aiQuestions.push({
      id: crypto.randomUUID(),
      question: `Een aandachtspunt bij deze match is: "${risk.label}". Kunt u hier meer over vertellen?`,
      category: "ai_generated",
      priority: 2,
    });
  }

  // Combine AI + template, assign IDs
  const templateWithIds = TEMPLATE_QUESTIONS.map((q) => ({
    ...q,
    id: crypto.randomUUID(),
  }));
  return [...aiQuestions, ...templateWithIds].sort((a, b) => a.priority - b.priority);
}

// ---------- CRUD ----------
export async function createScreeningCall(input: CreateScreeningCallInput) {
  const roomName = `screening-${input.candidateId.slice(0, 8)}-${Date.now()}`;

  // Fetch context snapshots in parallel
  const [candidateRow, jobRow, matchRow] = await Promise.all([
    db
      .select()
      .from(candidates)
      .where(eq(candidates.id, input.candidateId))
      .then((r) => r[0]),
    input.jobId
      ? db
          .select()
          .from(jobs)
          .where(eq(jobs.id, input.jobId))
          .then((r) => r[0])
      : null,
    input.matchId
      ? db
          .select()
          .from(jobMatches)
          .where(eq(jobMatches.id, input.matchId))
          .then((r) => r[0])
      : null,
  ]);

  if (!candidateRow) throw new Error("Kandidaat niet gevonden");

  // Generate screening questions
  const questions = await generateScreeningQuestions(
    candidateRow as unknown as Record<string, unknown>,
    (jobRow ?? {}) as Record<string, unknown>,
    (matchRow ?? {}) as Record<string, unknown>,
  );

  const [call] = await db
    .insert(screeningCalls)
    .values({
      candidateId: input.candidateId,
      jobId: input.jobId ?? null,
      matchId: input.matchId ?? null,
      applicationId: input.applicationId ?? null,
      roomName,
      status: "pending",
      initiatedBy: input.initiatedBy ?? "recruiter",
      screeningQuestions: questions,
      candidateContext: {
        name: candidateRow.name,
        email: candidateRow.email,
        phone: candidateRow.phone,
        role: candidateRow.role,
        location: candidateRow.location,
        skills: candidateRow.skills,
        hourlyRate: candidateRow.hourlyRate,
        availability: candidateRow.availability,
        experience: candidateRow.experience,
      },
      jobContext: jobRow
        ? {
            title: jobRow.title,
            company: jobRow.company,
            location: jobRow.location,
            rateMin: jobRow.rateMin,
            rateMax: jobRow.rateMax,
            requirements: jobRow.requirements,
            description: jobRow.description?.slice(0, 1000),
            contractType: jobRow.contractType,
          }
        : {},
      matchContext: matchRow
        ? {
            matchScore: matchRow.matchScore,
            reasoning: matchRow.reasoning,
            recommendation: matchRow.recommendation,
            criteriaBreakdown: matchRow.criteriaBreakdown,
            riskProfile: matchRow.riskProfile,
          }
        : {},
    })
    .returning();

  return call;
}

export async function getScreeningCall(id: string) {
  const [call] = await db.select().from(screeningCalls).where(eq(screeningCalls.id, id));
  return call ?? null;
}

export async function getScreeningCallByRoom(roomName: string) {
  const [call] = await db
    .select()
    .from(screeningCalls)
    .where(eq(screeningCalls.roomName, roomName));
  return call ?? null;
}

export async function listScreeningCalls(candidateId: string) {
  return db
    .select()
    .from(screeningCalls)
    .where(eq(screeningCalls.candidateId, candidateId))
    .orderBy(desc(screeningCalls.createdAt));
}

export async function updateScreeningCall(
  id: string,
  data: Partial<{
    status: string;
    transcript: unknown[];
    callSummary: string;
    callNotes: string;
    callDurationSeconds: number;
    candidateSentiment: string;
    recommendedNextStep: string;
    screeningQuestions: unknown[];
    startedAt: Date;
    endedAt: Date;
  }>,
) {
  const [updated] = await db
    .update(screeningCalls)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(screeningCalls.id, id))
    .returning();
  return updated ?? null;
}
