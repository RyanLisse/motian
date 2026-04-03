import { revalidatePath } from "next/cache";
import { publish } from "../lib/event-bus";
import { autoMatchCandidateToJobs } from "./auto-matching";
import type { CreateCandidateData } from "./candidates";
import {
  addNoteToCandidate,
  createCandidate,
  deleteCandidate,
  updateCandidate,
} from "./candidates";

export async function createCandidateWithEffects(data: CreateCandidateData) {
  const candidate = await createCandidate(data);
  revalidatePath("/kandidaten");
  revalidatePath("/overzicht");
  publish("candidate:created", { id: candidate.id, name: candidate.name });
  return candidate;
}

export async function updateCandidateWithEffects(id: string, data: Partial<CreateCandidateData>) {
  const candidate = await updateCandidate(id, data);
  if (!candidate) return null;
  revalidatePath("/kandidaten");
  revalidatePath(`/kandidaten/${id}`);
  publish("candidate:updated", { id, name: candidate.name });
  return candidate;
}

export async function deleteCandidateWithEffects(id: string) {
  const deleted = await deleteCandidate(id);
  if (!deleted) return false;
  revalidatePath("/kandidaten");
  publish("candidate:deleted", { id });
  return true;
}

export async function addNoteToCandidateWithEffects(id: string, note: string) {
  const candidate = await addNoteToCandidate(id, note);
  if (!candidate) return null;
  revalidatePath(`/kandidaten/${id}`);
  publish("candidate:updated", { id, action: "note_added" });
  return candidate;
}

export async function autoMatchCandidateWithEffects(candidateId: string) {
  const results = await autoMatchCandidateToJobs(candidateId);
  revalidatePath("/kandidaten");
  revalidatePath("/vacatures");
  revalidatePath("/overzicht");
  revalidatePath(`/kandidaten/${candidateId}`);
  publish("match:created", { candidateId, count: Array.isArray(results) ? results.length : 0 });
  return results;
}
