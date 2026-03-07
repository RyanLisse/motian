import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { parsedCVSchema } from "@/src/schemas/candidate-intelligence";
import { intakeCandidate } from "@/src/services/candidate-intake";
import { getCandidateById } from "@/src/services/candidates";

export const dynamic = "force-dynamic";

const intakeSchema = z
  .object({
    existingCandidateId: z.string().uuid().optional(),
    candidate: z
      .object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.string().optional(),
        skills: z.array(z.string()).optional(),
        location: z.string().optional(),
        source: z.string().optional(),
        linkedinUrl: z.string().url().optional(),
        headline: z.string().optional(),
        profileSummary: z.string().optional(),
        hourlyRate: z.number().int().positive().optional(),
        availability: z.enum(["direct", "1_maand", "3_maanden"]).optional(),
        notes: z.string().optional(),
        experience: z
          .array(z.object({ title: z.string(), company: z.string(), duration: z.string() }))
          .optional(),
        education: z
          .array(z.object({ school: z.string(), degree: z.string(), duration: z.string() }))
          .optional(),
      })
      .optional(),
    parsed: parsedCVSchema.optional(),
    resumeRaw: z.string().optional(),
    fileUrl: z.string().url().optional(),
  })
  .refine((value) => value.existingCandidateId || value.candidate || value.parsed, {
    message: "existingCandidateId, candidate of parsed is verplicht",
  });

export const POST = withApiHandler(async (request: Request) => {
  const body = await request.json();
  const parsed = intakeSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Ongeldige invoer", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.existingCandidateId) {
    const existingCandidate = await getCandidateById(parsed.data.existingCandidateId);

    if (!existingCandidate) {
      return Response.json({ error: "Kandidaat niet gevonden" }, { status: 404 });
    }
  }

  const result = await intakeCandidate(parsed.data);

  revalidatePath("/matching");
  revalidatePath("/professionals");
  revalidatePath(`/professionals/${result.candidate.id}`);

  return Response.json(result, {
    status: parsed.data.existingCandidateId ? 200 : 201,
  });
});
