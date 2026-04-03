import { revalidatePath } from "next/cache";
import { publish } from "../lib/event-bus";
import { createMatch, deleteMatch, updateMatchStatus } from "./matches";

export type CreateMatchData = {
  jobId: string;
  candidateId: string;
  matchScore: number;
  confidence?: number;
  reasoning?: string;
  model?: string;
  recommendation?: string;
};

function revalidateMatchViews(
  match: { jobId?: string | null; candidateId?: string | null } | null,
) {
  revalidatePath("/kandidaten");
  revalidatePath("/vacatures");
  revalidatePath("/pipeline");
  revalidatePath("/overzicht");
  if (match?.candidateId) revalidatePath(`/kandidaten/${match.candidateId}`);
  if (match?.jobId) revalidatePath(`/vacatures/${match.jobId}`);
}

export async function createMatchWithEffects(data: CreateMatchData) {
  const match = await createMatch(data);
  revalidateMatchViews(match);
  publish("match:created", { id: (match as { id: string }).id });
  return match;
}

export async function approveMatchWithEffects(id: string, reviewedBy?: string) {
  const result = await updateMatchStatus(id, "approved", reviewedBy);
  if (!result) return null;
  revalidateMatchViews(result);
  publish("match:updated", { id, status: "approved" });
  return result;
}

export async function rejectMatchWithEffects(id: string, reviewedBy?: string) {
  const result = await updateMatchStatus(id, "rejected", reviewedBy);
  if (!result) return null;
  revalidateMatchViews(result);
  publish("match:updated", { id, status: "rejected" });
  return result;
}

export async function deleteMatchWithEffects(
  id: string,
  match: { jobId?: string | null; candidateId?: string | null } | null,
) {
  const deleted = await deleteMatch(id);
  if (!deleted) return false;
  revalidateMatchViews(match);
  publish("match:deleted", { id });
  return true;
}
