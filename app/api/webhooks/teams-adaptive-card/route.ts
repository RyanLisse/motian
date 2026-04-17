import { NextResponse } from "next/server";
import { z } from "zod";
import { approveMatchWithEffects, rejectMatchWithEffects } from "@/src/services/match-effects";

const webhookSchema = z.object({
  action: z.literal("review_decision"),
  decision: z.enum(["approved", "rejected"]),
  reviewId: z.string().min(1),
  aadUserId: z.string().min(1),
});

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige payload" }, { status: 400 });
  }

  const result = webhookSchema.safeParse(payload);

  if (!result.success) {
    return NextResponse.json({ error: "Ongeldige payload" }, { status: 400 });
  }

  const reviewedBy = `aad:${result.data.aadUserId}`;
  const persistDecision =
    result.data.decision === "approved" ? approveMatchWithEffects : rejectMatchWithEffects;

  const match = await persistDecision(result.data.reviewId, reviewedBy);

  if (!match) {
    return NextResponse.json({ error: "Beoordeling niet gevonden" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    reviewId: result.data.reviewId,
    decision: result.data.decision,
    reviewedBy,
  });
}
